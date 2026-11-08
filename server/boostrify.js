import { config } from './config.js';

const { boostrify: b } = config;

/**
 * Boostrify adapter. Request shapes follow the Meta Cloud API format that Boostrify wraps.
 * Paths/base URL are configurable via .env so they can be aligned with Boostrify's official docs.
 */
const url = (path, vars = {}) =>
  b.base + path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? (k === 'phone' ? b.phoneId : '')));

const headers = (extra = {}) => ({
  Accept: 'application/json',
  ...(b.authKey ? { 'X-Auth-Key': b.authKey, 'X-App-Key': b.appKey } : {}),
  ...(b.key && !b.authKey ? { Authorization: `Bearer ${b.key}` } : {}),
  ...extra,
});

async function call(u, opts = {}) {
  const res = await fetch(u, { ...opts, headers: headers(opts.headers) });
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

async function getBoostrifySession(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && sessionState.authCookieHeader && (now - sessionState.lastLogin < 4 * 3600 * 1000)) {
    return sessionState;
  }

  const email = b.email || 'itservices@taager.com';
  const password = b.password || 'NEStu8zy';

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
    if (c.includes('XSRF-TOKEN=')) {
      const match = c.match(/XSRF-TOKEN=([^;]+)/);
      if (match) xsrfToken = decodeURIComponent(match[1]);
    }
    if (c.includes('boostrify_pro_session=')) {
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
}

/** Send native media via Live Chat session endpoint */
async function sendNativeMedia({ to, type, mediaUrl, caption }) {
  const directUrl = mediaUrl.includes('/v/') ? mediaUrl.replace('/v/', '/uploads/') : mediaUrl;
  let convId = await getConversationId(to);
  if (!convId) {
    conversationIdCache.clear();
    convId = await getConversationId(to);
  }

  if (!convId) {
    console.warn('[sendNativeMedia] Could not find conversation_id for phone', to);
    return null;
  }

  const mediaType = type === 'audio' || /\.(ogg|mp3|m4a|wav|webm)/i.test(directUrl) ? 'audio' : 'image';
  const payload = {
    conversation_id: convId,
    module: 'whatsapp',
    type: mediaType,
    attachments: [directUrl],
    caption: caption || '',
    reply_message_uuid: null,
  };

  console.log('[sendNativeMedia] Sending via /user/messages:', JSON.stringify(payload));

  let sess = await getBoostrifySession();
  let res = await fetch('https://boostrify.pro/user/messages', {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'X-XSRF-TOKEN': sess.xsrfToken,
      'Cookie': sess.authCookieHeader,
      'Referer': 'https://boostrify.pro/',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 419 || res.status === 401) {
    console.warn('[sendNativeMedia] Session expired (status', res.status, '), re-authenticating...');
    sess = await getBoostrifySession(true);
    res = await fetch('https://boostrify.pro/user/messages', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'X-XSRF-TOKEN': sess.xsrfToken,
        'Cookie': sess.authCookieHeader,
        'Referer': 'https://boostrify.pro/',
      },
      body: JSON.stringify(payload),
    });
  }

  const data = await res.json().catch(() => ({}));
  console.log('[sendNativeMedia] Response:', res.status, JSON.stringify(data.uuid ? { ok: true, uuid: data.uuid, type: data.type } : data));

  if (!res.ok || (!data.uuid && !data.id)) {
    throw new Error(`Boostrify live-chat send failed: ${JSON.stringify(data)}`);
  }

  return data.uuid || data.id || `live_${Date.now()}`;
}

/** Send text / image / audio / document. Returns the provider message id. */
export async function sendMessage({ line, to, type, body, mediaUrl, filename }) {
  // If sending media (image or audio) and we have Boostrify credentials, send native media!
  if (mediaUrl && (b.email || b.password)) {
    try {
      const uuid = await sendNativeMedia({ to, type, mediaUrl, caption: body });
      if (uuid) return uuid;
    } catch (err) {
      console.warn('[sendNativeMedia failed, falling back to REST API]:', err.message);
    }
  }

  // If Boostrify REST API credentials are used
  if (b.appKey && b.authKey) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      appkey: b.appKey,
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

    console.log('[Boostrify Send Payload]:', JSON.stringify(payload));
    const res = await call(b.base + '/whatsapp/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    console.log('[Boostrify Send Response]:', JSON.stringify(data));
    return data?.id || data?.message_id || data?.data?.id || `msg_${Date.now()}`;
  }

  // Fallback to Meta Cloud API format
  const payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to, type };
  if (type === 'text') payload.text = { body, preview_url: true };
  else if (type === 'image') payload.image = { link: mediaUrl, ...(body && { caption: body }) };
  else if (type === 'audio') payload.audio = { link: mediaUrl };
  else if (type === 'document') payload.document = { link: mediaUrl, filename, ...(body && { caption: body }) };
  else throw new Error(`Unsupported type: ${type}`);

  const res = await call(url(b.sendPath, { phone: line }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return data?.messages?.[0]?.id || data?.id || data?.message_id || `local_${Date.now()}`;
}

const conversationIdCache = new Map();

/** Get Boostrify conversation ID by customer phone */
export async function getConversationId(phone) {
  const clean = String(phone).replace(/\D/g, '');
  if (conversationIdCache.has(clean)) return conversationIdCache.get(clean);
  try {
    const res = await call(`${b.base}/whatsapp/v1/conversations?since=2025-01-01`);
    const json = await res.json();
    for (const c of json?.data || []) {
      const p = String(c.customer?.phone || '').replace(/\D/g, '');
      if (p && c.id) conversationIdCache.set(p, c.id);
    }
    return conversationIdCache.get(clean) || null;
  } catch (err) {
    console.warn('[getConversationId] failed:', err.message);
    return null;
  }
}

/** Pull message history for a contact. Returns array of normalized messages (see normalizeHistoryItem). */
export async function fetchHistory(line, contact) {
  if (b.appKey && b.authKey) {
    const convId = await getConversationId(contact);
    if (!convId) return [];
    try {
      const res = await call(`${b.base}/whatsapp/v1/conversations/${convId}/messages`);
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
          } catch {}
        }
        return {
          id,
          line,
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
      console.warn('[fetchHistory] failed for convId', convId, err.message);
      return [];
    }
  }

  const res = await call(url(b.historyPath, { phone: line, contact }));
  const data = await res.json();
  const items = data.data || data.messages || data.results || (Array.isArray(data) ? data : []);
  return items.map((i) => normalizeHistoryItem(i, line, contact)).filter(Boolean);
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
  if (b.appKey && b.authKey) {
    const cleanTo = String(to).replace(/[^0-9]/g, '');
    const payload = {
      appkey: b.appKey,
      authkey: b.authKey,
      to: cleanTo,
      type: 'template',
      template_name: name,
      language: language || 'ar',
      variables: params,
    };
    const res = await call(b.base + '/whatsapp/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return data?.id || data?.message_id || `tpl_${Date.now()}`;
  }

  const payload = {
    messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template',
    template: {
      name, language: { code: language },
      ...(params.length && { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text) })) }] }),
    },
  };
  const res = await call(url(b.sendPath, { phone: line }), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return data?.messages?.[0]?.id || data?.id || data?.message_id || `local_${Date.now()}`;
}
