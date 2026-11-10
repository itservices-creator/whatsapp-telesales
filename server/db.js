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
  conv_id INTEGER,
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

try {
  db.exec('ALTER TABLE contacts ADD COLUMN conv_id INTEGER');
} catch (_) {}

// One-time startup cleanup: remove duplicate outgoing messages created by webhook/REST mismatch
try {
  db.exec(`
    DELETE FROM messages
    WHERE rowid IN (
      SELECT m1.rowid
      FROM messages m1
      JOIN messages m2 ON m1.line = m2.line
                      AND m1.phone = m2.phone
                      AND m1.direction = 'out'
                      AND m2.direction = 'out'
                      AND m1.type = m2.type
                      AND m1.body = m2.body
                      AND m1.rowid < m2.rowid
                      AND ABS(m1.ts - m2.ts) < 45000
    );
  `);
} catch (_) {}

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

  // Deduplication for outgoing messages:
  // If an outgoing message with identical content was recorded in the last 45 seconds,
  // update its ID to the official wamid / provider ID rather than creating a duplicate row!
  if (m.direction === 'out') {
    const recent = db.prepare(`
      SELECT * FROM messages
      WHERE line = ? AND phone = ? AND direction = 'out'
        AND (
          (type = 'text' AND body = ?) OR
          (type != 'text' AND (type = ? OR (media_url IS NOT NULL AND media_url = ?)))
        )
        AND ts >= ? - 45000 AND ts <= ? + 45000
      ORDER BY ts DESC LIMIT 1
    `).get(m.line, m.phone, m.body ?? '', m.type ?? '', m.media_url ?? '', m.ts, m.ts);

    if (recent) {
      const targetId = (m.id && m.id.startsWith('wamid')) ? m.id : recent.id;
      db.prepare(`
        UPDATE messages
        SET id = ?,
            status = CASE WHEN ? = 'failed' THEN 'failed' ELSE COALESCE(?, status) END,
            media_url = COALESCE(?, media_url),
            mime = COALESCE(?, mime)
        WHERE id = ?
      `).run(targetId, m.status, m.status, m.media_url, m.mime, recent.id);

      const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(targetId);
      return { ...updated, _isUpdate: true, _oldId: recent.id };
    }
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
try { db.exec('ALTER TABLE users ADD COLUMN can_manage_users INTEGER NOT NULL DEFAULT 0'); } catch { /* already exists */ }

export const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
};
const verifyHash = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pw, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
};

const pub = 'id, username, name, role, allowed_lines, active, can_manage_users';
export const listUsers = () => db.prepare(`SELECT ${pub} FROM users ORDER BY id`).all();
export const getUser = (id) => (id == null ? undefined : db.prepare(`SELECT ${pub} FROM users WHERE id = ?`).get(id));
export const createUser = ({ username, name, password, role = 'agent', allowed_lines = '', can_manage_users = 0 }) =>
  db.prepare('INSERT INTO users (username, name, pass, role, allowed_lines, can_manage_users) VALUES (?,?,?,?,?,?)')
    .run(username.trim().toLowerCase(), name.trim(), hashPassword(password), role, Array.isArray(allowed_lines) ? allowed_lines.join(',') : allowed_lines, can_manage_users ? 1 : 0).lastInsertRowid;
export const updateUser = (id, { name, password, role, allowed_lines, active, can_manage_users }) => {
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  if (password) db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(hashPassword(password), id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (allowed_lines !== undefined) {
    const val = Array.isArray(allowed_lines) ? allowed_lines.join(',') : allowed_lines;
    db.prepare('UPDATE users SET allowed_lines = ? WHERE id = ?').run(val, id);
  }
  if (active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  if (can_manage_users !== undefined) db.prepare('UPDATE users SET can_manage_users = ? WHERE id = ?').run(can_manage_users ? 1 : 0, id);
};
export function authenticate(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username).trim().toLowerCase());
  if (!u || !verifyHash(String(password), u.pass)) return null;
  return getUser(u.id);
}
/** Make sure an admin exists (password from ADMIN_PASSWORD / STAFF_PASSWORD). */
export function ensureAdmin(password) {
  // Update any existing admin to super_admin or create default super_admin
  const existingSuper = db.prepare("SELECT id FROM users WHERE role = 'super_admin'").get();
  if (!existingSuper) {
    const oldAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' AND username = 'admin'").get();
    if (oldAdmin) {
      db.prepare("UPDATE users SET role = 'super_admin' WHERE id = ?").run(oldAdmin.id);
    } else {
      createUser({ username: 'admin', name: 'المدير العام', password: password || 'admin123', role: 'super_admin', allowed_lines: '' });
    }
  }
}

export const getAgentLine = (user) => {
  const first = (user?.allowed_lines || '').split(',').map((s) => s.trim()).filter(Boolean)[0];
  if (first && config.lines.some((l) => String(l.id) === String(first))) return String(first);
  return String(config.lines[0]?.id || '191');
};

export const canAccessLine = (user, lineId) => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  return String(lineId) === getAgentLine(user);
};

const withOwner = `SELECT c.*, u.name AS owner_name FROM contacts c LEFT JOIN users u ON u.id = c.owner`;
/** Agents see their own chats ONLY on their assigned line. Admins & Super Admins see all chats. */
export const listContactsFor = (user) => {
  if (user.role === 'super_admin' || user.role === 'admin') {
    return db.prepare(`${withOwner} ORDER BY c.last_message_at DESC`).all();
  }
  const agentLine = getAgentLine(user);
  return db.prepare(`${withOwner} WHERE c.line = ? AND c.owner = ? ORDER BY c.last_message_at DESC`).all(agentLine, user.id);
};

export const getContact = (line, phone) =>
  db.prepare(`${withOwner} WHERE c.line = ? AND c.phone = ?`).get(line, phone);
export const canAccess = (user, contact) => {
  if (!contact) return false;
  if (!canAccessLine(user, contact.line)) return false;
  return user.role === 'super_admin' || user.role === 'admin' || contact.owner === user.id;
};

export function ensureContact(line, phone, name, owner) {
  db.prepare('INSERT OR IGNORE INTO contacts (line, phone, name, owner) VALUES (?,?,?,?)').run(line, phone, name || '', owner ?? null);
  if (name) db.prepare("UPDATE contacts SET name = ? WHERE line = ? AND phone = ? AND (name IS NULL OR name = '')").run(name, line, phone);
}
export const setOwner = (line, phone, owner) =>
  db.prepare('UPDATE contacts SET owner = ? WHERE line = ? AND phone = ?').run(owner ?? null, line, phone);
export const claimIfUnowned = (line, phone, uid) =>
  db.prepare('UPDATE contacts SET owner = ? WHERE line = ? AND phone = ? AND owner IS NULL').run(uid, line, phone);

export const setContactConvId = (lineOrPhone, phoneOrConvId, maybeConvId) => {
  if (maybeConvId !== undefined) {
    const line = String(lineOrPhone || '').trim();
    const clean = String(phoneOrConvId || '').replace(/\D/g, '');
    if (!line || !clean || !maybeConvId) return;
    db.prepare('UPDATE contacts SET conv_id = ? WHERE line = ? AND phone = ?').run(maybeConvId, line, clean);
    return;
  }
  const clean = String(lineOrPhone || '').replace(/\D/g, '');
  if (!clean || !phoneOrConvId) return;
  db.prepare('UPDATE contacts SET conv_id = ? WHERE phone = ?').run(phoneOrConvId, clean);
};

export const getContactConvId = (lineOrPhone, maybePhone) => {
  if (maybePhone !== undefined) {
    const line = String(lineOrPhone || '').trim();
    const clean = String(maybePhone || '').replace(/\D/g, '');
    if (!line || !clean) return null;
    const row = db.prepare('SELECT conv_id FROM contacts WHERE line = ? AND phone = ? AND conv_id IS NOT NULL').get(line, clean);
    return row?.conv_id || null;
  }
  const clean = String(lineOrPhone || '').replace(/\D/g, '');
  if (!clean) return null;
  const row = db.prepare('SELECT conv_id FROM contacts WHERE phone = ? AND conv_id IS NOT NULL').get(clean);
  return row?.conv_id || null;
};

/** WhatsApp 24h customer-service window: free text allowed only if the customer wrote within 24h. */
export const windowOpen = (line, phone) => {
  const r = db.prepare("SELECT MAX(ts) AS t FROM messages WHERE line = ? AND phone = ? AND direction = 'in'").get(line, phone);
  return !!r?.t && Date.now() - r.t < 24 * 3600 * 1000;
};
