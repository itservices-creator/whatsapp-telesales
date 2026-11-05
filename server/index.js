import express from 'express';
import multer from 'multer';
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
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
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'forbidden' });

/** Deliver realtime events only to the admin room and the chat owner (or the pool for that specific line). */
function emitFor(event, payload, line, phone) {
  const c = getContact(line, phone);
  if (c?.owner) {
    io.to('admin').to(`u:${c.owner}`).emit(event, payload);
  } else {
    io.to('admin').to(`line:${line}`).emit(event, payload);
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
    handleWebhook(parsed);
  } catch (err) {
    console.error('webhook error', err);
  }
};

app.get('/webhook', handleWebhookGet);
app.get('/webhooks/boostrify', handleWebhookGet);

app.post('/webhook', express.raw({ type: '*/*', limit: '5mb' }), handleWebhookPost);
app.post('/webhooks/boostrify', express.raw({ type: '*/*', limit: '5mb' }), handleWebhookPost);

function handleWebhook(body) {
  // 1. Boostrify native events format ($data['events'])
  if (Array.isArray(body.events)) {
    for (const ev of body.events) {
      const from = ev.customer?.phone || ev.from || ev.sender || ev.phone || ev.to;
      const custName = ev.customer?.name || ev.name || ev.sender_name || '';
      const text = ev.text || ev.message || ev.body || (typeof ev.data === 'string' ? ev.data : '');
      const direction = ev.direction === 'out' || ev.from_me ? 'out' : 'in';
      const msgId = ev.wamid || String(ev.id) || `boost_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const line = String(ev.number_id || body.number_id || config.lines[0]?.id || '191');
      const ts = ev.created_at ? new Date(ev.created_at).getTime() : (ev.timestamp ? Number(ev.timestamp) * 1000 : Date.now());

      if (from && (text || ev.media_url)) {
        const row = saveMessage({
          id: msgId,
          line,
          phone: from,
          direction,
          type: ev.media_url ? (ev.type || 'image') : 'text',
          body: text,
          media_url: ev.media_url,
          ts,
        }, custName);
        if (row) {
          emitFor('message', row, line, from);
          refreshAll();
        }
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
  const permitted = req.user.role === 'admin'
    ? config.lines
    : config.lines.filter((l) => canAccessLine(req.user, l.id));
  res.json({ lines: permitted, allLines: config.lines, demo: config.demo });
});
app.get('/api/templates', requireAuth, (_req, res) => {
  try { templates = JSON.parse(readFileSync(resolve('templates.json'), 'utf8')); } catch { /* optional */ }
  res.json(templates);
});



// --- employees (admin) ---
app.get('/api/users', requireAuth, (_req, res) => res.json(listUsers()));
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, name, password, role, allowed_lines } = req.body || {};
  if (!username || !name || !password || String(password).length < 4) return res.status(400).json({ error: 'بيانات ناقصة (كلمة المرور 4 أحرف على الأقل)' });
  try {
    res.json(getUser(createUser({ username, name, password, role: role === 'admin' ? 'admin' : 'agent', allowed_lines })));
  } catch { res.status(409).json({ error: 'اسم المستخدم موجود بالفعل' }); }
});
app.patch('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
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
  if (existing && !canAccess(req.user, existing)) return res.status(409).json({ error: `العميل ده مع الموظف ${existing.owner_name}` });
  ensureContact(line, phone, String(req.body?.name || '').trim(), req.user.id);
  claimIfUnowned(line, phone, req.user.id);
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
  if (!config.demo && config.boostrify.key && req.query.sync !== '0') {
    try {
      for (const m of await fetchHistory(line, phone)) saveMessage(m, '');
    } catch (err) {
      console.warn('history sync failed:', err.message);
    }
  }
  markRead(line, phone);
  res.json({ messages: listMessages(line, phone), windowOpen: windowOpen(line, phone), contact: getContact(line, phone) });
});

async function makePublicMediaUrl(file) {
  try {
    const fileBytes = await readFile(file.path);
    const form = new FormData();
    form.append('file', new Blob([fileBytes], { type: file.mimetype }), file.originalname);
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: form,
    });
    const json = await res.json();
    if (json?.data?.url) {
      const direct = json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      console.log('[Media Direct CDN URL]:', direct);
      return direct;
    }
  } catch (err) {
    console.warn('[CDN Upload failed, fallback to ngrok]:', err.message);
  }
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
      id = config.demo ? `demo_out_${Date.now()}` : await sendTemplate({ line, to, name: tpl.name, language: tpl.language, params });
    } else {
      if (file) {
        mime = file.mimetype;
        type = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'document';
        filename = file.originalname;
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
  const m = getMessage(req.params.id);
  if (!m) return res.sendStatus(404);
  if (!canAccess(req.user, getContact(m.line, m.phone))) return res.sendStatus(403);
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
  if (u.role === 'admin') {
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
