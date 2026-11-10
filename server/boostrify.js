import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { config, resolveLineId, getLineAppKey } from './config.js';
import { getContactConvId, setContactConvId } from './db.js';

const { boostrify: b } = config;

/**
 * Boostrify adapter. Request shapes follow the Meta Cloud API format that Boostrify wraps.
 * Paths/base URL are configurable via .env so they can be aligned with Boostrify's official docs.
 */
const url = (path, vars = {}) =>
  b.base + path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? (k === 'phone' ? b.phoneId : '')));

const headers = (extra = {}, lineId = null) => {
  const appKey = lineId ? getLineAppKey(lineId) : b.appKey;
  return {
    Accept: 'application/json',
    ...(b.authKey ? { 'X-Auth-Key': b.authKey, 'X-App-Key': appKey } : {}),
    ...(b.key && !b.authKey ? { Authorization: `Bearer ${b.key}` } : {}),
    ...extra,
  };
};

async function call(u, opts = {}) {
  const res = await fetch(u, { ...opts, headers: headers(opts.headers, opts.line) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`Boostrify ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
  }
  return res;
}

let sessionState = {
  xsrfToken: '',
  sessionCookie: '',
  authCookieHeader: '',
  lastLogin: 0,
};
let loginPromise = null;

async function getBoostrifySession(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && sessionState.authCookieHeader && (now - sessionState.lastLogin < 4 * 3600 * 1000)) {
    return sessionState;
  }
  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      const email = b.email || 'itservices@taager.com';
      const password = b.password || 'T@Ag^er@2028#';

      console.log('[Boostrify Session] Logging in as', email, '...');
      const getRes = await fetch('https://boostrify.pro/login', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const rawCookies = getRes.headers.getSetCookie ? getRes.headers.getSetCookie() : [getRes.headers.get('set-cookie')];
      let xsrfToken = '', sessionCookie = '';

      for (const c of rawCookies) {
        if (c && c.includes('XSRF-TOKEN=')) {
          const match = c.match(/XSRF-TOKEN=([^;]+)/);
          if (match) xsrfToken = decodeURIComponent(match[1]);
        }
        if (c && c.includes('boostrify_pro_session=')) {
          const match = c.match(/boostrify_pro_session=([^;]+)/);
          if (match) sessionCookie = match[1];
        }
      }

      const cookieHeader = `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; boostrify_pro_session=${sessionCookie}`;

      const postRes = await fetch('https://boostrify.pro/login', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'X-XSRF-TOKEN': xsrfToken,
          'X-Inertia': 'true',
          'Cookie': cookieHeader,
          'Referer': 'https://boostrify.pro/login',
        },
        body: JSON.stringify({ email, password, remember: true }),
        redirect: 'manual',
      });

      // Note: Inertia returns 409 with X-Inertia-Location on successful login redirect
      if (postRes.status >= 400 && postRes.status !== 409) {
        const errText = await postRes.text().catch(() => '');
        sessionState = { xsrfToken: '', sessionCookie: '', authCookieHeader: '', lastLogin: 0 };
        throw new Error(`Boostrify login failed (${postRes.status}): ${errText.slice(0, 200)}`);
      }

      const postCookies = postRes.headers.getSetCookie ? postRes.headers.getSetCookie() : [postRes.headers.get('set-cookie')];
      if (postCookies && postCookies.length) {
        for (const c of postCookies) {
          if (c && c.includes('boostrify_pro_session=')) {
            const match = c.match(/boostrify_pro_session=([^;]+)/);
            if (match) sessionCookie = match[1];
          }
          if (c && c.includes('XSRF-TOKEN=')) {
            const match = c.match(/XSRF-TOKEN=([^;]+)/);
            if (match) xsrfToken = decodeURIComponent(match[1]);
          }
        }
      }

      sessionState = {
        xsrfToken,
        sessionCookie,
        authCookieHeader: `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; boostrify_pro_session=${sessionCookie}`,
        lastLogin: Date.now(),
      };

      console.log('[Boostrify Session] Login successful, session established.');
      return sessionState;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

/** Perform an authenticated GET to Boostrify's web session endpoints with automatic 401/419 retry. */
async function sessionGet(endpoint) {
  const doReq = async (forceRefresh) => {
    const sess = await getBoostrifySession(forceRefresh);
    return fetch(endpoint, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json, text/plain, */*',
        'X-XSRF-TOKEN': sess.xsrfToken,
        'Cookie': sess.authCookieHeader,
        'Referer': 'https://boostrify.pro/user/live-chat',
      },
    });
  };

  let res = await doReq(false);
  if (res.status === 419 || res.status === 401) {
    console.warn(`[sessionGet] Session expired on ${endpoint} (${res.status}), re-authenticating...`);
    res = await doReq(true);
  }
  return res;
}

/** Perform an authenticated POST to Boostrify's web session endpoints with automatic 401/419 retry. */
async function sessionPost(endpoint, { jsonBody, formData } = {}) {
  const doReq = async (forceRefresh) => {
    const sess = await getBoostrifySession(forceRefresh);
    const hdrs = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Accept': 'application/json, text/plain, */*',
      'X-XSRF-TOKEN': sess.xsrfToken,
      'Cookie': sess.authCookieHeader,
      'Referer': 'https://boostrify.pro/user/live-chat',
    };
    if (jsonBody !== undefined) hdrs['Content-Type'] = 'application/json';
    return fetch(endpoint, {
      method: 'POST',
      headers: hdrs,
      body: jsonBody !== undefined ? JSON.stringify(jsonBody) : formData,
    });
  };

  let res = await doReq(false);
  if (res.status === 419 || res.status === 401) {
    console.warn(`[sessionPost] Session expired on ${endpoint} (${res.status}), re-authenticating...`);
    res = await doReq(true);
  }
  return res;
}

/** Upload local media file directly to Boostrify's storage so it sends natively (not as an external link). */
async function uploadMediaToBoostrify({ filePath, mediaType, mime, filename }) {
  const buf = await readFile(filePath);
  const uploadEndpoint = mediaType === 'audio'
    ? 'https://boostrify.pro/user/whatsapp/upload-voice'
    : 'https://boostrify.pro/user/whatsapp/upload-media';
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime || 'application/octet-stream' }), filename || basename(filePath));

  const res = await sessionPost(uploadEndpoint, { formData: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(`Boostrify upload failed (${res.status}): ${JSON.stringify(data)}`);
  }
  console.log('[uploadMediaToBoostrify] Uploaded to Boostrify:', data.url);
  return data.url;
}

/** Send native media via Live Chat session endpoint */
async function sendNativeMedia({ line, to, type, mediaUrl, filePath, mime, filename, caption }) {
  const lineId = resolveLineId(line);
  const directUrl = mediaUrl.includes('/v/') ? mediaUrl.replace('/v/', '/uploads/') : mediaUrl;
  let convId = await getConversationId(to, lineId);
  if (!convId) {
    conversationIdCache.delete(`${lineId}:${String(to).replace(/\D/g, '')}`);
    convId = await getConversationId(to, lineId);
  }

  if (!convId) {
    console.warn('[sendNativeMedia] Could not find conversation_id for phone', to, 'on line', lineId);
    return null;
  }

  let mediaType = type;
  if (!mediaType || mediaType === 'document') {
    if (/\.(mp4|mov|avi|3gp|mkv)$/i.test(directUrl)) mediaType = 'video';
    else if (/\.(ogg|mp3|m4a|wav|webm)$/i.test(directUrl) || directUrl.includes('voice_')) mediaType = 'audio';
    else if (/\.(jpeg|jpg|png|webp|gif)$/i.test(directUrl)) mediaType = 'image';
    else mediaType = 'document';
  }

  let attachmentUrl = directUrl;
  if (filePath) {
    attachmentUrl = await uploadMediaToBoostrify({ filePath, mediaType, mime, filename });
  }

  const payload = {
    conversation_id: convId,
    module: 'whatsapp',
    type: mediaType,
    attachments: [attachmentUrl],
    caption: caption || '',
    reply_message_uuid: null,
  };

  console.log(`[sendNativeMedia line=${lineId}] Sending via /user/messages:`, JSON.stringify(payload));
  const res = await sessionPost('https://boostrify.pro/user/messages', { jsonBody: payload });
  const data = await res.json().catch(() => ({}));
  console.log(`[sendNativeMedia line=${lineId}] Response:`, res.status, JSON.stringify(data.uuid ? { ok: true, uuid: data.uuid, type: data.type } : data));

  if (!res.ok || (!data.uuid && !data.id)) {
    throw new Error(`Boostrify live-chat send failed: ${JSON.stringify(data)}`);
  }

  return data.uuid || data.id || `live_${Date.now()}`;
}

/** Send native standalone text via Live Chat session endpoint (no quoting / no reply context) */
async function sendNativeText({ line, to, text }) {
  const lineId = resolveLineId(line);
  let convId = await getConversationId(to, lineId);
  if (!convId) {
    conversationIdCache.delete(`${lineId}:${String(to).replace(/\D/g, '')}`);
    convId = await getConversationId(to, lineId);
  }

  if (!convId) {
    console.warn('[sendNativeText] Could not find conversation_id for phone', to, 'on line', lineId);
    return null;
  }

  const payload = {
    conversation_id: convId,
    type: 'text',
    text: text,
    module: 'whatsapp',
  };

  console.log(`[sendNativeText line=${lineId}] Sending via /user/messages:`, JSON.stringify(payload));
  const res = await sessionPost('https://boostrify.pro/user/messages', { jsonBody: payload });
  const data = await res.json().catch(() => ({}));
  console.log(`[sendNativeText line=${lineId}] Response:`, res.status, JSON.stringify(data.uuid ? { ok: true, uuid: data.uuid } : data));

  if (!res.ok || (!data.uuid && !data.id)) {
    throw new Error(`Boostrify live-chat text send failed: ${JSON.stringify(data)}`);
  }

  return data.uuid || data.id || `live_${Date.now()}`;
}

/** Send text / image / audio / document. Returns the provider message id. */
export async function sendMessage({ line, to, type, body, mediaUrl, filePath, mime, filename }) {
  const lineId = resolveLineId(line);
  // If we have Boostrify credentials, send through the Live Chat session endpoint.
  // This ensures outgoing messages are sent fast and STANDALONE (NOT quoting the previous message).
  if (b.email || b.password) {
    if (mediaUrl) {
      try {
        const uuid = await sendNativeMedia({ line: lineId, to, type, mediaUrl, filePath, mime, filename, caption: body });
        if (uuid) return uuid;
      } catch (err) {
        console.warn('[sendNativeMedia failed, falling back to REST API]:', err.message);
      }
    } else if (body && body.trim()) {
      try {
        const uuid = await sendNativeText({ line: lineId, to, text: body.trim() });
        if (uuid) return uuid;
      } catch (err) {
        console.warn('[sendNativeText failed, falling back to REST API]:', err.message);
      }
    }
  }

  // Fallback to Boostrify REST API credentials (uses the line's specific appKey!)
  const lineAppKey = getLineAppKey(lineId);
  if (lineAppKey && b.authKey) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      appkey: lineAppKey,
      authkey: b.authKey,
      to: cleanTo,
    };

    if (mediaUrl) {
      const directUrl = mediaUrl.replace('/v/', '/uploads/');
      payload.media_url = directUrl;
      payload.message = (body && body.trim()) ? `${body.trim()}\n${directUrl}` : directUrl;
    } else {
      payload.message = body || '';
    }

    console.log(`[Boostrify REST Send line=${lineId}]:`, JSON.stringify(payload));
    const res = await call(b.base + '/whatsapp/message', {
      method: 'POST',
      line: lineId,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[Boostrify REST Send Response line=${lineId}]:`, JSON.stringify(data));
    // Clear cache so newly created conversation_id on this line is discovered on next message
    conversationIdCache.delete(`${lineId}:${cleanTo}`);
    return data?.id || data?.message_id || data?.data?.id || `msg_${Date.now()}`;
  }

  // Fallback to Meta Cloud API format
  const payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to, type };
  if (type === 'text') payload.text = { body, preview_url: true };
  else if (type === 'image') payload.image = { link: mediaUrl, ...(body && { caption: body }) };
  else if (type === 'audio') payload.audio = { link: mediaUrl };
  else if (type === 'document') payload.document = { link: mediaUrl, filename, ...(body && { caption: body }) };
  else throw new Error(`Unsupported type: ${type}`);

  const res = await call(url(b.sendPath, { phone: lineId }), {
    method: 'POST',
    line: lineId,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return data?.messages?.[0]?.id || data?.id || data?.message_id || `local_${Date.now()}`;
}

const conversationIdCache = new Map();

/** Get Boostrify conversation ID by customer phone and company line ID */
export async function getConversationId(phone, line = '191') {
  const lineId = resolveLineId(line);
  const clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;
  const cacheKey = `${lineId}:${clean}`;
  if (conversationIdCache.has(cacheKey)) return conversationIdCache.get(cacheKey);

  // Check persistent DB cache first for 0ms lookup
  const dbConvId = getContactConvId(lineId, clean);
  if (dbConvId) {
    conversationIdCache.set(cacheKey, dbConvId);
    return dbConvId;
  }

  // 1. Fast lookup via Boostrify Live Chat search scoped to device_id (lineId)
  if (b.email || b.password) {
    try {
      const searchUrl = `https://boostrify.pro/user/live-chat-search?q=${encodeURIComponent(clean)}&device_id=${encodeURIComponent(lineId)}`;
      const sRes = await sessionGet(searchUrl);
      if (sRes.ok) {
        const sJson = await sRes.json().catch(() => ({}));
        for (const c of sJson?.conversations || []) {
          const cPlat = String(c.platform_id || lineId);
          const rawPhone = c.customer?.uuid || c.customer?.meta?.phone || c.customer?.phone || '';
          const p = String(rawPhone).replace(/\D/g, '');
          if (p && c.id) {
            conversationIdCache.set(`${cPlat}:${p}`, c.id);
            setContactConvId(cPlat, p, c.id);
          }
        }
        if (conversationIdCache.has(cacheKey)) {
          return conversationIdCache.get(cacheKey);
        }
      }
    } catch (err) {
      console.warn(`[getConversationId live-chat-search line=${lineId}] failed:`, err.message);
    }
  }

  // 2. Fallback to REST API v1/conversations with line-specific X-App-Key
  try {
    let page = 1;
    let lastPage = 1;
    do {
      const res = await call(`${b.base}/whatsapp/v1/conversations?since=2025-01-01&page=${page}`, { line: lineId });
      const json = await res.json();
      lastPage = Number(json?.last_page || 1);
      for (const c of json?.data || []) {
        const p = String(c.customer?.phone || '').replace(/\D/g, '');
        if (p && c.id) {
          conversationIdCache.set(`${lineId}:${p}`, c.id);
          setContactConvId(lineId, p, c.id);
        }
      }
      if (conversationIdCache.has(cacheKey)) break;
      page++;
    } while (page <= Math.min(lastPage, 25));
    return conversationIdCache.get(cacheKey) || null;
  } catch (err) {
    console.warn(`[getConversationId REST line=${lineId}] failed:`, err.message);
    return null;
  }
}

/** Pull message history for a contact. Returns array of normalized messages (see normalizeHistoryItem). */
export async function fetchHistory(line, contact) {
  const lineId = resolveLineId(line);
  const lineAppKey = getLineAppKey(lineId);
  if (lineAppKey && b.authKey) {
    const convId = await getConversationId(contact, lineId);
    if (!convId) return [];
    try {
      const res = await call(`${b.base}/whatsapp/v1/conversations/${convId}/messages`, { line: lineId });
      const data = await res.json();
      const items = data.data || [];
      return items.map((i) => {
        const id = i.wamid || String(i.id);
        const ts = i.created_at ? new Date(i.created_at).getTime() : Date.now();
        const direction = i.direction === 'out' || i.from_me ? 'out' : 'in';
        let type = i.type || 'text';
        if (type === 'sticker') type = 'image';
        let media_url = i.media_url;
        let body = i.text || '';
        if (typeof body === 'string' && body.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(body);
            if (parsed.url || parsed.link) {
              if (!media_url || media_url.includes('lookaside.fbsbx.com')) {
                media_url = parsed.url || parsed.link;
              }
              body = '';
            }
          } catch { }
        }
        return {
          id,
          line: lineId,
          phone: contact,
          direction,
          type,
          body,
          media_url,
          status: i.status || 'sent',
          ts,
        };
      }).filter(Boolean);
    } catch (err) {
      console.warn('[fetchHistory] failed for convId', convId, 'on line', lineId, err.message);
      return [];
    }
  }

  const res = await call(url(b.historyPath, { phone: lineId, contact }), { line: lineId });
  const data = await res.json();
  const items = data.data || data.messages || data.results || (Array.isArray(data) ? data : []);
  return items.map((i) => normalizeHistoryItem(i, lineId, contact)).filter(Boolean);
}

/** Resolve a media id to a downloadable Response (authorized). */
export async function fetchMedia(mediaId) {
  const meta = await (await call(url(b.mediaPath, { id: mediaId }))).json();
  const direct = meta.url || meta.link;
  if (!direct) throw new Error('No media url returned');
  return call(direct); // Meta media URLs require the same bearer token
}

function normalizeHistoryItem(i, line, contact) {
  const parsed = parseMessage(i);
  if (!parsed) return null;
  const fromMe = i.direction === 'outbound' || i.direction === 'out' || i.from_me === true || i.from === line;
  return { ...parsed, line, phone: contact, direction: fromMe ? 'out' : 'in' };
}

/** Parse a single Meta-style message object -> our internal shape (without phone/direction). */
export function parseMessage(m) {
  if (!m || !m.id) return null;
  const ts = (Number(m.timestamp) || Math.floor(Date.now() / 1000)) * 1000;
  const base = { id: m.id, ts };
  switch (m.type) {
    case 'text':
      return { ...base, type: 'text', body: m.text?.body ?? '' };
    case 'image':
      return { ...base, type: 'image', body: m.image?.caption ?? '', media_id: m.image?.id, media_url: m.image?.link, mime: m.image?.mime_type };
    case 'audio':
      return { ...base, type: 'audio', media_id: m.audio?.id, media_url: m.audio?.link, mime: m.audio?.mime_type };
    case 'voice':
      return { ...base, type: 'audio', media_id: m.voice?.id, media_url: m.voice?.link, mime: m.voice?.mime_type };
    case 'document':
      return { ...base, type: 'document', body: m.document?.caption ?? '', media_id: m.document?.id, media_url: m.document?.link, mime: m.document?.mime_type, filename: m.document?.filename };
    case 'button':
      return { ...base, type: 'text', body: m.button?.text ?? '' };
    case 'interactive':
      return { ...base, type: 'text', body: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '' };
    default:
      return { ...base, type: 'other', body: `[${m.type || 'unsupported'}]` };
  }
}

/** Send an approved template (required to start a conversation / outside the 24h window). */
export async function sendTemplate({ line, to, name, language, params = [] }) {
  const lineId = resolveLineId(line);
  const lineAppKey = getLineAppKey(lineId);
  if (lineAppKey && b.authKey) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      appkey: lineAppKey,
      authkey: b.authKey,
      to: cleanTo,
      type: 'template',
      template_name: name,
      language: language || 'ar',
      variables: params,
    };
    const res = await call(b.base + '/whatsapp/message', {
      method: 'POST',
      line: lineId,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    conversationIdCache.delete(`${lineId}:${cleanTo}`);
    return data?.id || data?.message_id || `tpl_${Date.now()}`;
  }

  const payload = {
    messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template',
    template: {
      name, language: { code: language },
      ...(params.length && { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text) })) }] }),
    },
  };
  const res = await call(url(b.sendPath, { phone: lineId }), {
    method: 'POST', line: lineId, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return data?.messages?.[0]?.id || data?.id || data?.message_id || `local_${Date.now()}`;
}

// Pre-warm session in background so sending has zero latency
setTimeout(() => {
  getBoostrifySession().catch(() => { });
}, 1000);
