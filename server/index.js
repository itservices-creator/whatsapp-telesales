import express from 'express';
import multer from 'multer';
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, createWriteStream } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Server } from 'socket.io';
import { config } from './config.js';
import {
  saveMessage, listMessages, markRead, updateStatus, getMessage,
  listContactsFor, getContact, canAccess, canAccessLine, ensureContact, setOwner, claimIfUnowned, windowOpen,
  authenticate, ensureAdmin, listUsers, getUser, createUser, updateUser,
} from './db.js';
import { sendMessage, sendTemplate, fetchHistory, fetchMedia, parseMessage } from './boostrify.js';
import { seedDemo } from './demo.js';

ensureAdmin(config.adminPassword);
if (config.demo) seedDemo();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

let templates = [];
try { templates = JSON.parse(readFileSync(resolve('templates.json'), 'utf8')); } catch { /* optional */ }
const renderTemplate = (t, params) => t.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[i - 1] ?? '');

const UPLOAD_DIR = resolve('data/uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * Download a remote media URL (e.g. from lookaside.fbsbx.com) and save it locally.
 * Returns the local /uploads/<filename> path, or null on failure.
 */
async function downloadMedia(url, mimeHint) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'WhatsappBot/1.0', Accept: 'image/*,audio/*,video/*,*/*' },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.warn('[downloadMedia] upstream', res.status, url.slice(0, 80));
      return null;
    }
    const ct = res.headers.get('content-type') || mimeHint || 'application/octet-stream';
    // Derive a file extension from content-type
    const extMap = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/gif': 'gif', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
      'audio/wav': 'wav', 'video/mp4': 'mp4', 'application/pdf': 'pdf',
    };
    const baseType = ct.split(';')[0].trim().toLowerCase();
    const ext = extMap[baseType] || baseType.split('/')[1] || 'bin';
    const filename = `${randomBytes(12).toString('hex')}.${ext}`;
    const filePath = resolve(UPLOAD_DIR, filename);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(filePath));
    console.log('[downloadMedia] saved:', filename, '(', ct, ')');
    return `/uploads/${filename}`;
  } catch (err) {
    console.warn('[downloadMedia] failed:', err.message, url.slice(0, 80));
    return null;
  }
}
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_r, f, cb) => cb(null, randomBytes(12).toString('hex') + extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 16 * 1024 * 1024 },
});

// ---------- Sessions ----------
const sessions = new Map(); // sid -> userId
const cookieOf = (req, name) =>
  (req.headers.cookie || '').split(/;\s*/).map((c) => c.split('=')).find(([k]) => k === name)?.[1];
const safeEq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const userFromReq = (req) => {
  const u = getUser(sessions.get(cookieOf(req, 'sid')));
  return u?.active ? u : null;
};
const requireAuth = (req, res, next) => {
  const u = userFromReq(req);
  if (!u) return res.status(401).json({ error: 'unauthorized' });
  req.user = u;
  next();
};
const requireAdmin = (req, res, next) =>
  (req.user.role === 'super_admin' || req.user.role === 'admin') ? next() : res.status(403).json({ error: 'forbidden' });

const requireSuperAdmin = (req, res, next) =>
  req.user.role === 'super_admin' ? next() : res.status(403).json({ error: 'صلاحية المدير العام فقط (Super Admin)' });

/** Deliver realtime events only to the admin room and the chat owner. */
function emitFor(event, payload, line, phone) {
  const c = getContact(line, phone);
  if (c?.owner) {
    io.to('admin').to(`u:${c.owner}`).emit(event, payload);
  } else {
    io.to('admin').emit(event, payload);
  }
}
const refreshAll = () => io.emit('refresh');

// ---------- Webhook (must read RAW body for signature check) ----------
const handleWebhookGet = (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.webhook.verifyToken) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  // If Boostrify does a simple GET ping
  res.status(200).send('Webhook active');
};

const handleWebhookPost = (req, res) => {
  const raw = req.body;
  if (config.webhook.appSecret) {
    const sig = String(req.headers['x-boostrify-signature'] || req.headers['x-hub-signature-256'] || '').replace('sha256=', '');
    const expected = createHmac('sha256', config.webhook.appSecret).update(raw).digest('hex');
    if (!sig || !safeEq(sig, expected)) return res.sendStatus(401);
  }
  res.sendStatus(200); // ack immediately; process after
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    console.log('[Webhook] Received:', JSON.stringify(parsed));
    handleWebhook(parsed).catch((err) => console.error('webhook async error', err));
  } catch (err) {
    console.error('webhook error', err);
  }
};

app.get('/webhook', handleWebhookGet);
app.get('/webhooks/boostrify', handleWebhookGet);

app.post('/webhook', express.raw({ type: '*/*', limit: '5mb' }), handleWebhookPost);
app.post('/webhooks/boostrify', express.raw({ type: '*/*', limit: '5mb' }), handleWebhookPost);

async function handleWebhook(body) {
  // 1. Boostrify native events format ($data['events'])
  if (Array.isArray(body.events)) {
    for (const ev of body.events) {
      const from = ev.customer?.phone || ev.from || ev.sender || ev.phone || ev.to;
      const custName = ev.customer?.name || ev.name || ev.sender_name || '';
      const direction = ev.direction === 'out' || ev.from_me ? 'out' : 'in';
      const msgId = ev.wamid || String(ev.id) || `boost_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const line = String(ev.number_id || body.number_id || config.lines[0]?.id || '191');
      const ts = ev.created_at ? new Date(ev.created_at).getTime() : (ev.timestamp ? Number(ev.timestamp) * 1000 : Date.now());

      // Boostrify sometimes encodes media metadata as a JSON string in the text field.
      // Detect and unwrap it to extract the actual URL and mime type.
      let rawText = ev.text || ev.message || ev.body || (typeof ev.data === 'string' ? ev.data : '');
      let mediaUrl = ev.media_url || null;
      let mimeHint = ev.mime_type || null;
      let msgType = ev.type || 'text';

      if (typeof rawText === 'string' && rawText.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawText);
          // Boostrify wraps media as: { mime_type, sha256, id, url, link, image/audio/video: { link } }
          const url = parsed.url || parsed.link
            || parsed.image?.link || parsed.audio?.link || parsed.video?.link
            || parsed.header?.image?.link || null;
          const mime = parsed.mime_type || null;
          if (url && (url.includes('lookaside.fbsbx.com') || url.includes('cdn') || url.startsWith('http'))) {
            mediaUrl = url;
            mimeHint = mime || mimeHint;
            // Determine type from mime
            if (mime) {
              if (mime.startsWith('image/')) msgType = 'image';
              else if (mime.startsWith('audio/')) msgType = 'audio';
              else if (mime.startsWith('video/')) msgType = 'video';
              else msgType = 'document';
            } else {
              msgType = 'image'; // default fallback
            }
            rawText = '';
          }
        } catch { /* not JSON, keep as-is */ }
      }

      // Also handle when ev.media_url is set directly (Boostrify newer format)
      if (!mediaUrl && ev.media_url) mediaUrl = ev.media_url;
      if (mediaUrl && msgType === 'text') {
        // Guess type from mime or URL
        if (mimeHint?.startsWith('audio/')) msgType = 'audio';
        else if (mimeHint?.startsWith('video/')) msgType = 'video';
        else msgType = 'image';
      }

      // *** Download and save media locally immediately so URLs don't expire ***
      if (mediaUrl && mediaUrl.startsWith('http')) {
        const localPath = await downloadMedia(mediaUrl, mimeHint);
        if (localPath) mediaUrl = localPath;
      }

      const text = rawText;

      if (from && (text || mediaUrl)) {
        const row = saveMessage({
          id: msgId,
          line,
          phone: from,
          direction,
          type: msgType,
          body: text,
          media_url: mediaUrl,
          ts,
        }, custName);
        if (row) {
          if (row._isUpdate) {
            emitFor('status', { id: row.id, oldId: row._oldId, status: row.status || 'sent', line, phone: from }, line, from);
          } else {
            emitFor('message', row, line, from);
            refreshAll();
          }
        }
      }

      // If this is a media message, Boostrify processes and stores it permanently on boostrify.pro/uploads
      // within 1-2 seconds. Schedule a background sync to fetch the clean permanent media_url.
      if (from && (msgType === 'image' || msgType === 'audio' || msgType === 'sticker' || msgType === 'voice' || (mediaUrl && mediaUrl.includes('lookaside.fbsbx.com')))) {
        setTimeout(async () => {
          try {
            const items = await fetchHistory(line, from);
            for (const item of items) saveMessage(item, '');
            refreshAll();
          } catch (e) {
            console.warn('[Delayed media sync error]:', e.message);
          }
        }, 2500);
      }
      if (ev.status && ev.id) {
        const u = updateStatus(String(ev.id), ev.status) || (ev.wamid && updateStatus(ev.wamid, ev.status));
        if (u) emitFor('status', u, u.line, u.phone);
      }
    }
    return;
  }

  // 2. Meta Cloud API format (body.entry)
  const values = (body.entry || []).flatMap((e) => (e.changes || []).map((c) => c.value)).filter(Boolean);
  for (const v of values) {
    // Which of our numbers received it (Meta format: metadata.phone_number_id / display_phone_number)
    const md = v.metadata || {};
    const line = config.lines.find((l) => l.id === md.phone_number_id || l.id === md.display_phone_number)?.id
      || md.phone_number_id || config.lines[0].id;
    const names = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
    for (const m of v.messages || []) {
      const parsed = parseMessage(m);
      if (!parsed) continue;
      const row = saveMessage({ ...parsed, line, phone: m.from, direction: 'in' }, names[m.from]);
      if (row) emitFor('message', row, line, m.from);
    }
    for (const s of v.statuses || []) {
      const u = updateStatus(s.id, s.status);
      if (u) emitFor('status', u, u.line, u.phone);
    }
  }
}

/** Demo only: mark message delivered/read, then fake a customer reply. */
function simulateCustomer(line, phone, id) {
  setTimeout(() => { const u = updateStatus(id, 'delivered'); if (u) emitFor('status', u, line, phone); }, 800);
  setTimeout(() => { const u = updateStatus(id, 'read'); if (u) emitFor('status', u, line, phone); }, 1800);
  setTimeout(() => {
    const row = saveMessage({ id: `demo_in_${Date.now()}`, line, phone, direction: 'in', type: 'text', body: 'تمام، شكراً ليك 👍', ts: Date.now() });
    if (row) emitFor('message', row, line, phone);
  }, 3500);
}

// ---------- API ----------
app.use(express.json());
app.use(express.static(resolve('public')));
app.use('/uploads', (req, res, next) => {
  console.log('[Upload Access]:', req.method, req.url, 'User-Agent:', req.headers['user-agent']);
  next();
}, express.static(UPLOAD_DIR)); // public: Boostrify/Meta must be able to fetch outgoing files

app.post('/api/login', (req, res) => {
  const user = authenticate(req.body?.username || '', req.body?.password || '');
  if (!user) return res.status(401).json({ error: 'wrong credentials' });
  const sid = randomBytes(24).toString('hex');
  sessions.set(sid, user.id);
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);
  res.json(user);
});
app.post('/api/logout', (req, res) => {
  sessions.delete(cookieOf(req, 'sid'));
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/me', requireAuth, (req, res) => res.json(req.user));
app.get('/api/lines', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
  const permitted = isAdmin
    ? config.lines
    : config.lines.filter((l) => canAccessLine(req.user, l.id));
  const finalLines = permitted.length ? permitted : config.lines;
  res.json({ lines: finalLines, allLines: config.lines, demo: config.demo });
});
app.get('/api/templates', requireAuth, (_req, res) => {
  try { templates = JSON.parse(readFileSync(resolve('templates.json'), 'utf8')); } catch { /* optional */ }
  res.json(templates);
});



// --- employees (admin / super_admin) ---
app.get('/api/users', requireAuth, (_req, res) => res.json(listUsers()));
app.post('/api/users', requireAuth, requireSuperAdmin, (req, res) => {
  const { username, name, password, role, allowed_lines } = req.body || {};
  if (!username || !name || !password || String(password).length < 4) return res.status(400).json({ error: 'بيانات ناقصة (كلمة المرور 4 أحرف على الأقل)' });
  try {
    const validRole = role === 'super_admin' ? 'super_admin' : (role === 'admin' ? 'admin' : 'agent');
    res.json(getUser(createUser({ username, name, password, role: validRole, allowed_lines })));
  } catch { res.status(409).json({ error: 'اسم المستخدم موجود بالفعل' }); }
});
app.patch('/api/users/:id', requireAuth, requireSuperAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!getUser(id)) return res.sendStatus(404);
  if (id === req.user.id && req.body.active === false) return res.status(400).json({ error: 'لا يمكنك تعطيل حسابك' });
  updateUser(id, req.body || {});
  refreshAll();
  res.json(getUser(id));
});

// --- chats ---
app.get('/api/contacts', requireAuth, (req, res) => res.json(listContactsFor(req.user)));

/** Start a new conversation with a customer number; the employee who starts it owns it. */
app.post('/api/chats', requireAuth, (req, res) => {
  const line = String(req.body?.line || '');
  const phone = String(req.body?.phone || '').replace(/\D/g, '').replace(/^00/, '');
  if (!config.lines.some((l) => l.id === line)) return res.status(400).json({ error: 'رقم الشركة غير صحيح' });
  if (!canAccessLine(req.user, line)) return res.status(403).json({ error: 'ليس لديك صلاحية استخدام هذا الرقم' });
  if (phone.length < 8 || phone.length > 15) return res.status(400).json({ error: 'رقم العميل غير صحيح (اكتبه بصيغة دولية بدون +، مثال 201001234567)' });
  const existing = getContact(line, phone);
  const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';
  if (existing && existing.owner && existing.owner !== req.user.id && !isAdmin) {
    return res.status(409).json({ error: `العميل ده مع الموظف ${existing.owner_name}` });
  }
  ensureContact(line, phone, String(req.body?.name || '').trim(), req.user.id);
  setOwner(line, phone, req.user.id);
  refreshAll();
  res.json(getContact(line, phone));
});

app.patch('/api/chats/:line/:phone/owner', requireAuth, requireAdmin, (req, res) => {
  const { line, phone } = req.params;
  if (!getContact(line, phone)) return res.sendStatus(404);
  const uid = req.body?.userId ? Number(req.body.userId) : null;
  if (uid && !getUser(uid)) return res.status(400).json({ error: 'موظف غير موجود' });
  setOwner(line, phone, uid);
  refreshAll();
  res.json(getContact(line, phone));
});

app.get('/api/contacts/:line/:phone/messages', requireAuth, async (req, res) => {
  const { line, phone } = req.params;
  const contact = getContact(line, phone);
  if (!canAccess(req.user, contact)) return res.sendStatus(403);
  // Sync history from Boostrify on open (best-effort; local cache is the fallback).
  if (!config.demo && (config.boostrify.key || config.boostrify.appKey) && req.query.sync !== '0') {
    try {
      for (const m of await fetchHistory(line, phone)) saveMessage(m, '');
    } catch (err) {
      console.warn('history sync failed:', err.message);
    }
  }
  markRead(line, phone);
  res.json({ messages: listMessages(line, phone), windowOpen: windowOpen(line, phone), contact: getContact(line, phone) });
});

// Public rich preview page for shared media on WhatsApp
app.get('/v/:filename', (req, res) => {
  const filename = req.params.filename;
  const fileUrl = `${config.publicBaseUrl}/uploads/${filename}`;
  const isAudio = /\.(ogg|webm|mp3|m4a|wav)$/i.test(filename);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (isAudio) {
    return res.send(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WAFY Store 🎤 رسالة صوتية</title>
  <meta property="og:title" content="WAFY Store 🎤 رسالة صوتية" />
  <meta property="og:description" content="اضغط للاستماع للرسالة الصوتية" />
  <meta property="og:type" content="music.song" />
  <style>
    body { margin:0; background:#0b141a; color:#e9edef; font-family:system-ui,-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; box-sizing:border-box; }
    .card { background:#111b21; border:1px solid #202c33; border-radius:18px; padding:28px 24px; max-width:400px; width:100%; text-align:center; box-shadow:0 8px 24px rgba(0,0,0,0.5); }
    .icon { font-size:48px; margin-bottom:12px; }
    h2 { font-size:18px; margin:0 0 6px; color:#00a884; }
    p { font-size:13px; color:#8696a0; margin:0 0 20px; }
    audio { width:100%; outline:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎙️</div>
    <h2>WAFY Store</h2>
    <p>رسالة صوتية من خدمة العملاء</p>
    <audio controls autoplay src="${fileUrl}"></audio>
  </div>
</body>
</html>`);
  }
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WAFY Store 🛍️</title>
  <meta property="og:title" content="WAFY Store 🛍️" />
  <meta property="og:description" content="اضغط لمشاهدة الصورة" />
  <meta property="og:image" content="${fileUrl}" />
  <meta property="og:image:secure_url" content="${fileUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${fileUrl}" />
</head>
<body style="margin:0;background:#0b141a;display:flex;align-items:center;justify-content:center;height:100vh;">
  <img src="${fileUrl}" alt="WAFY Store" style="max-width:96%;max-height:96vh;object-fit:contain;border-radius:8px;" />
</body>
</html>`);
});

async function makePublicMediaUrl(file) {
  return `${config.publicBaseUrl}/uploads/${file.filename}`;
}

app.post('/api/contacts/:line/:phone/send', requireAuth, upload.single('file'), async (req, res) => {
  const to = req.params.phone, line = req.params.line;
  const contact = getContact(line, to);
  if (!contact) return res.status(404).json({ error: 'ابدأ المحادثة أولاً' });
  if (!canAccess(req.user, contact)) return res.sendStatus(403);
  const text = String(req.body?.text || '').trim();
  const file = req.file;
  try {
    let type = 'text', mediaUrl, mime, filename, body = text, id;
    const tpl = req.body?.template && templates.find((t) => t.name === req.body.template);

    if (tpl) {
      const params = JSON.parse(req.body.params || '[]');
      if (params.length < tpl.params.length || params.some((p) => !String(p).trim())) return res.status(400).json({ error: 'املأ كل متغيرات القالب' });
      body = renderTemplate(tpl, params);
      if (tpl.is_quick_text) {
        id = config.demo ? `demo_out_${Date.now()}` : await sendMessage({ line, to, type: 'text', body });
      } else {
        id = config.demo ? `demo_out_${Date.now()}` : await sendTemplate({ line, to, name: tpl.name, language: tpl.language, params });
      }
    } else {
      if (file) {
        mime = file.mimetype || '';
        if (req.body?.type) {
          type = req.body.type;
        } else if (mime.startsWith('image/')) {
          type = 'image';
        } else if (mime.startsWith('video/') || /\.(mp4|mov|avi|3gp|mkv)$/i.test(file.originalname)) {
          type = 'video';
        } else if (mime.startsWith('audio/') || /\.(ogg|mp3|m4a|wav|webm)$/i.test(file.originalname) || file.originalname.includes('voice_')) {
          type = 'audio';
        } else {
          type = 'document';
        }
        filename = file.originalname;

        // If audio (like recorded voice notes), convert to ogg opus if not already .ogg
        if (type === 'audio' && !file.filename.endsWith('.ogg')) {
          const oggFilename = file.filename.replace(/\.[^.]+$/, '') + '.ogg';
          const inputPath = resolve(UPLOAD_DIR, file.filename);
          const outputPath = resolve(UPLOAD_DIR, oggFilename);
          try {
            await execFileAsync('ffmpeg', ['-y', '-i', inputPath, '-c:a', 'libopus', '-b:a', '32k', outputPath]);
            file.filename = oggFilename;
            mime = 'audio/ogg';
            filename = filename.replace(/\.[^.]+$/, '') + '.ogg';
            unlink(inputPath).catch(() => {});
          } catch (ffmpegErr) {
            console.warn('[ffmpeg conversion skipped/failed]:', ffmpegErr.message);
          }
        }

        mediaUrl = await makePublicMediaUrl(file);
      } else if (!text) return res.status(400).json({ error: 'empty message' });
      id = config.demo ? `demo_out_${Date.now()}` : await sendMessage({ line, to, type, body: text, mediaUrl, filename });
    }

    const wasUnowned = contact.owner == null;
    if (wasUnowned) { claimIfUnowned(line, to, req.user.id); refreshAll(); }
    const savedMediaUrl = file ? `/uploads/${file.filename}` : mediaUrl;
    const row = saveMessage({
      id, line, phone: to, direction: 'out', type, body, media_url: savedMediaUrl, mime, filename,
      status: 'sent', ts: Date.now(),
    });
    if (row) emitFor('message', row, line, to);
    if (config.demo) simulateCustomer(line, to, id);
    res.json(row);
  } catch (err) {
    console.error('send failed', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Media: direct URLs are redirected (pass-through); media ids are proxied with auth, never stored.
app.get('/api/media/:id', requireAuth, async (req, res) => {
  let m = getMessage(req.params.id);
  if (!m) return res.sendStatus(404);
  if (!canAccess(req.user, getContact(m.line, m.phone))) return res.sendStatus(403);

  // If the media_url points to lookaside.fbsbx.com, it expires quickly and returns 401 without Meta auth.
  // Resolve the permanent boostrify.pro URL by syncing the latest conversation messages.
  if (m.media_url && m.media_url.includes('lookaside.fbsbx.com')) {
    try {
      const items = await fetchHistory(m.line, m.phone);
      for (const item of items) saveMessage(item, '');
      const fresh = getMessage(req.params.id);
      if (fresh && fresh.media_url && !fresh.media_url.includes('lookaside.fbsbx.com')) {
        m = fresh;
      }
    } catch (err) {
      console.warn('[media sync fallback error]:', err.message);
    }
  }

  try {
    if (m.media_id) {
      const upstream = await fetchMedia(m.media_id);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || m.mime || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      const len = upstream.headers.get('content-length');
      if (len) res.setHeader('Content-Length', len);
      return void (await pipeline(Readable.fromWeb(upstream.body), res));
    }
    if (m.media_url) {
      if (m.media_url.startsWith('/uploads/')) {
        const localPath = resolve(UPLOAD_DIR, m.media_url.replace('/uploads/', ''));
        return res.sendFile(localPath);
      }
      // Proxy external URLs (e.g. boostrify.pro/uploads or CDN) through our server
      try {
        const upstream = await fetch(m.media_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': '*/*',
          },
          redirect: 'follow',
        });
        if (upstream.ok) {
          const ct = upstream.headers.get('content-type') || m.mime || 'application/octet-stream';
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const len = upstream.headers.get('content-length');
          if (len) res.setHeader('Content-Length', len);
          return void (await pipeline(Readable.fromWeb(upstream.body), res));
        }
        console.warn('[media proxy] upstream responded', upstream.status, 'for', m.media_url);
      } catch (proxyErr) {
        console.warn('[media proxy] fetch failed:', proxyErr.message);
      }
      // Fallback: redirect directly
      return res.redirect(m.media_url);
    }
    res.sendStatus(404);
  } catch (err) {
    console.error('media failed', err.message);
    res.sendStatus(502);
  }
});

// ---------- Socket.IO (staff only) ----------
io.use((socket, next) => {
  const u = userFromReq(socket.request);
  if (!u) return next(new Error('unauthorized'));
  socket.join(`u:${u.id}`);
  if (u.role === 'super_admin' || u.role === 'admin') {
    socket.join('admin');
  } else {
    const allowed = (u.allowed_lines || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const lineId of allowed) {
      socket.join(`line:${lineId}`);
    }
  }
  next();
});

httpServer.listen(config.port, () => {
  console.log(`Support chat running on http://localhost:${config.port}`);
  console.log(`Webhook URL: ${config.publicBaseUrl}/webhook`);
});

// Boostrify Integration Active - Live chat
export { app, handleWebhook };
