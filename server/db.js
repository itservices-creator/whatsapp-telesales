import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { config } from './config.js';

mkdirSync('data', { recursive: true });
export const db = new DatabaseSync(process.env.DB_FILE || 'data/chat.db');

db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  line TEXT NOT NULL,               -- our WhatsApp number (one of the company lines)
  phone TEXT NOT NULL,              -- customer number
  name TEXT,
  last_message_at INTEGER DEFAULT 0,
  last_preview TEXT DEFAULT '',
  unread INTEGER DEFAULT 0,
  PRIMARY KEY (line, phone)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  line TEXT NOT NULL,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL,          -- in | out
  type TEXT NOT NULL,               -- text | image | audio | document | other
  body TEXT DEFAULT '',
  media_url TEXT,                   -- direct URL (pass-through or our upload)
  media_id TEXT,                    -- Meta/Boostrify media id (resolved via proxy)
  mime TEXT,
  filename TEXT,
  status TEXT DEFAULT 'sent',
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON messages(line, phone, ts);
`);

const previewOf = (m) =>
  m.type === 'text' ? m.body : ({ image: '📷 صورة', audio: '🎤 رسالة صوتية', document: '📄 ملف' }[m.type] || 'رسالة');

/** Insert a message (idempotent on id) and update the contact row. Returns the stored row, or null if duplicate. */
export function saveMessage(m, contactName) {
  const existing = db.prepare('SELECT id, type, media_url, body FROM messages WHERE id = ?').get(m.id);
  if (existing) {
    // If incoming has a valid media_url and existing is broken/missing, update it
    if (m.media_url && (!existing.media_url || existing.media_url.includes('lookaside.fbsbx.com'))) {
      db.prepare('UPDATE messages SET media_url = ?, type = ?, body = ? WHERE id = ?')
        .run(m.media_url, m.type || existing.type, m.body || '', m.id);
      return db.prepare('SELECT * FROM messages WHERE id = ?').get(m.id);
    }
    return null;
  }
  db.prepare(
    `INSERT INTO messages (id, line, phone, direction, type, body, media_url, media_id, mime, filename, status, ts)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(m.id, m.line, m.phone, m.direction, m.type, m.body ?? '', m.media_url ?? null, m.media_id ?? null,
    m.mime ?? null, m.filename ?? null, m.status ?? 'sent', m.ts);

  const inc = m.direction === 'in' ? 1 : 0;
  db.prepare(
    `INSERT INTO contacts (line, phone, name, last_message_at, last_preview, unread)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(line, phone) DO UPDATE SET
       name = COALESCE(NULLIF(?, ''), name),
       last_message_at = MAX(last_message_at, excluded.last_message_at),
       last_preview = CASE WHEN excluded.last_message_at >= last_message_at THEN excluded.last_preview ELSE last_preview END,
       unread = unread + ?`,
  ).run(m.line, m.phone, contactName || '', m.ts, previewOf(m), inc, contactName || '', inc);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(m.id);
}

export const listContacts = (line) =>
  line
    ? db.prepare('SELECT * FROM contacts WHERE line = ? ORDER BY last_message_at DESC').all(line)
    : db.prepare('SELECT * FROM contacts ORDER BY last_message_at DESC').all();

export const listMessages = (line, phone, limit = 200) =>
  db.prepare('SELECT * FROM (SELECT * FROM messages WHERE line = ? AND phone = ? ORDER BY ts DESC LIMIT ?) ORDER BY ts ASC').all(line, phone, limit);

export const getMessage = (id) => db.prepare('SELECT * FROM messages WHERE id = ?').get(id);

export const markRead = (line, phone) => db.prepare('UPDATE contacts SET unread = 0 WHERE line = ? AND phone = ?').run(line, phone);

export const updateStatus = (id, status) => {
  const rank = { sent: 1, delivered: 2, read: 3 };
  const cur = getMessage(id);
  if (!cur) return null;
  if (status !== 'failed' && (rank[status] ?? 0) < (rank[cur.status] ?? 0)) return null;
  db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, id);
  return { id, line: cur.line, phone: cur.phone, status };
};

export const messageCount = () => db.prepare('SELECT COUNT(*) AS n FROM messages').get().n;

// ---------- Employees & chat ownership ----------
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pass TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',   -- admin | agent
  allowed_lines TEXT DEFAULT '',        -- comma-separated line IDs (empty/all for admin)
  active INTEGER NOT NULL DEFAULT 1
);`);
try { db.exec('ALTER TABLE contacts ADD COLUMN owner INTEGER'); } catch { /* already exists */ }
try { db.exec("ALTER TABLE users ADD COLUMN allowed_lines TEXT DEFAULT ''"); } catch { /* already exists */ }

export const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
};
const verifyHash = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
};

const pub = 'id, username, name, role, allowed_lines, active';
export const listUsers = () => db.prepare(`SELECT ${pub} FROM users ORDER BY id`).all();
export const getUser = (id) => (id == null ? undefined : db.prepare(`SELECT ${pub} FROM users WHERE id = ?`).get(id));
export const createUser = ({ username, name, password, role = 'agent', allowed_lines = '' }) =>
  db.prepare('INSERT INTO users (username, name, pass, role, allowed_lines) VALUES (?,?,?,?,?)')
    .run(username.trim().toLowerCase(), name.trim(), hashPassword(password), role, Array.isArray(allowed_lines) ? allowed_lines.join(',') : allowed_lines).lastInsertRowid;
export const updateUser = (id, { name, password, role, allowed_lines, active }) => {
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  if (password) db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPassword(password), id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (allowed_lines !== undefined) {
    const val = Array.isArray(allowed_lines) ? allowed_lines.join(',') : allowed_lines;
    db.prepare('UPDATE users SET allowed_lines = ? WHERE id = ?').run(val, id);
  }
  if (active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
};
export function authenticate(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username).trim().toLowerCase());
  if (!u || !verifyHash(String(password), u.pass)) return null;
  return getUser(u.id);
}
/** Make sure an admin exists (password from ADMIN_PASSWORD / STAFF_PASSWORD). */
export function ensureAdmin(password) {
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!admin) {
    createUser({ username: 'admin', name: 'المدير', password, role: 'admin', allowed_lines: '' });
  } else if (password) {
    updateUser(admin.id, { password });
  }
}

export const canAccessLine = (user, lineId) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  // If company only has 1 line configured, everyone has access to it
  if (config.lines && config.lines.length === 1 && String(lineId) === String(config.lines[0].id)) return true;
  // If user has no specific allowed_lines or it's empty, allow all company lines by default
  if (!user.allowed_lines || user.allowed_lines.trim() === '') return true;
  const list = user.allowed_lines.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(String(lineId));
};

const withOwner = `SELECT c.*, u.name AS owner_name FROM contacts c LEFT JOIN users u ON u.id = c.owner`;
/** Agents see their own chats ONLY (assigned to them or created by them). Admins see all chats. */
export const listContactsFor = (user) => {
  if (user.role === 'admin') {
    return db.prepare(`${withOwner} ORDER BY c.last_message_at DESC`).all();
  }
  const lines = (user.allowed_lines || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!lines.length || (config.lines && config.lines.length === 1)) {
    return db.prepare(`${withOwner} WHERE c.owner = ? ORDER BY c.last_message_at DESC`).all(user.id);
  }
  const placeholders = lines.map(() => '?').join(',');
  return db.prepare(`${withOwner} WHERE c.line IN (${placeholders}) AND c.owner = ? ORDER BY c.last_message_at DESC`).all(...lines, user.id);
};

export const getContact = (line, phone) =>
  db.prepare(`${withOwner} WHERE c.line = ? AND c.phone = ?`).get(line, phone);
export const canAccess = (user, contact) => {
  if (!contact) return false;
  if (!canAccessLine(user, contact.line)) return false;
  return user.role === 'admin' || contact.owner === user.id;
};

export function ensureContact(line, phone, name, owner) {
  db.prepare('INSERT OR IGNORE INTO contacts (line, phone, name, owner) VALUES (?,?,?,?)').run(line, phone, name || '', owner ?? null);
  if (name) db.prepare("UPDATE contacts SET name = ? WHERE line = ? AND phone = ? AND (name IS NULL OR name = '')").run(name, line, phone);
}
export const setOwner = (line, phone, owner) =>
  db.prepare('UPDATE contacts SET owner = ? WHERE line = ? AND phone = ?').run(owner ?? null, line, phone);
export const claimIfUnowned = (line, phone, uid) =>
  db.prepare('UPDATE contacts SET owner = ? WHERE line = ? AND phone = ? AND owner IS NULL').run(uid, line, phone);

/** WhatsApp 24h customer-service window: free text allowed only if the customer wrote within 24h. */
export const windowOpen = (line, phone) => {
  const r = db.prepare("SELECT MAX(ts) AS t FROM messages WHERE line = ? AND phone = ? AND direction = 'in'").get(line, phone);
  return !!r?.t && Date.now() - r.t < 24 * 3600 * 1000;
};
