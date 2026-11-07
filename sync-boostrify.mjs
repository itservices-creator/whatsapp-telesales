// Sync all conversations and messages from Boostrify API into SQLite
// Usage: node --experimental-sqlite --env-file=.env sync-boostrify.mjs

import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { config } from './server/config.js';

const DB_PATH = resolve('data/chat.db');
const db = new DatabaseSync(DB_PATH);

const b = config.boostrify;
if (!b.appKey || !b.authKey) {
  console.error('Missing Boostrify credentials in .env!');
  process.exit(1);
}

const headers = {
  'X-App-Key': b.appKey,
  'X-Auth-Key': b.authKey,
  'Accept': 'application/json',
};

async function run() {
  console.log('🔄 Fetching conversations from Boostrify...');
  const res = await fetch(`${b.base}/whatsapp/v1/conversations?since=2025-01-01`, { headers });
  if (!res.ok) {
    console.error('Boostrify API error:', res.status, await res.text());
    process.exit(1);
  }
  const json = await res.json();
  const convs = json.data || [];
  console.log(`📋 Found ${convs.length} conversations.`);

  let totalMsgs = 0;
  let totalMedia = 0;

  for (const [idx, conv] of convs.entries()) {
    const phone = String(conv.customer?.phone || '').replace(/\D/g, '');
    const name = conv.customer?.name || '';
    const line = String(conv.number_id || b.phoneId || config.lines[0]?.id || '191');
    if (!phone) continue;

    console.log(`[${idx + 1}/${convs.length}] Syncing conversation ${conv.id} (${phone} - ${name})...`);

    try {
      const mRes = await fetch(`${b.base}/whatsapp/v1/conversations/${conv.id}/messages`, { headers });
      if (!mRes.ok) continue;
      const mJson = await mRes.json();
      const messages = mJson.data || [];

      for (const m of messages) {
        const id = m.wamid || String(m.id);
        const direction = m.direction === 'out' || m.from_me ? 'out' : 'in';
        let type = m.type || 'text';
        if (type === 'sticker') type = 'image';
        let media_url = m.media_url || null;
        let body = m.text || '';

        // If body is JSON, extract permanent media URL
        if (typeof body === 'string' && body.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(body);
            const u = parsed.url || parsed.link || parsed.image?.link || parsed.audio?.link || null;
            if (u && (!media_url || media_url.includes('lookaside.fbsbx.com'))) {
              media_url = u;
            }
            body = '';
          } catch {}
        }

        // If media_url points to lookaside, see if JSON has boostrify.pro URL
        if (media_url && media_url.includes('lookaside.fbsbx.com')) {
          const match = (m.text || '').match(/https:\/\/boostrify\.pro\/uploads\/[^\s"\\}]+/);
          if (match) media_url = match[0];
        }

        if (media_url && type === 'text') {
          type = 'image';
        }

        const ts = m.created_at ? new Date(m.created_at).getTime() : Date.now();

        // Check if message exists in DB
        const existing = db.prepare('SELECT id, media_url FROM messages WHERE id = ?').get(id);
        if (existing) {
          // Update media_url and type if needed
          if (media_url && (!existing.media_url || existing.media_url.includes('lookaside.fbsbx.com'))) {
            db.prepare('UPDATE messages SET media_url = ?, type = ?, body = ? WHERE id = ?')
              .run(media_url, type, body, id);
            totalMedia++;
          }
        } else {
          db.prepare(`
            INSERT INTO messages (id, line, phone, direction, type, body, media_url, status, ts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, line, phone, direction, type, body, media_url, m.status || 'sent', ts);
          totalMsgs++;
          if (media_url) totalMedia++;
        }
      }

      // Update contact
      const lastMsg = messages[messages.length - 1];
      const lastTs = lastMsg?.created_at ? new Date(lastMsg.created_at).getTime() : Date.now();
      const lastPreview = lastMsg?.text || (lastMsg?.type === 'image' ? '📷 صورة' : lastMsg?.type === 'audio' ? '🎤 رسالة صوتية' : 'رسالة');

      db.prepare(`
        INSERT INTO contacts (line, phone, name, last_message_at, last_preview, unread)
        VALUES (?, ?, ?, ?, ?, 0)
        ON CONFLICT(line, phone) DO UPDATE SET
          name = COALESCE(NULLIF(excluded.name, ''), name),
          last_message_at = MAX(last_message_at, excluded.last_message_at),
          last_preview = excluded.last_preview
      `).run(line, phone, name, lastTs, lastPreview);

    } catch (err) {
      console.warn(`Failed syncing messages for conv ${conv.id}:`, err.message);
    }
  }

  console.log(`\n🎉 Sync complete!`);
  console.log(`- New messages inserted: ${totalMsgs}`);
  console.log(`- Media messages updated with permanent URLs: ${totalMedia}`);
  db.close();
}

run().catch(console.error);
