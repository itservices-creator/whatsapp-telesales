// Fix existing messages in DB that have JSON image metadata stored as body text
// Run once on the server: node --experimental-sqlite --env-file=.env fix-images-db.mjs

import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const DB_PATH = resolve('data/chat.db');
const db = new DatabaseSync(DB_PATH);

// Find messages where body contains lookaside URLs or JSON image metadata
const msgs = db.prepare(`
  SELECT id, body, media_url, type FROM messages 
  WHERE body LIKE '%lookaside.fbsbx.com%' OR body LIKE '%"mime_type"%'
`).all();

console.log(`Found ${msgs.length} messages with JSON image data to fix...`);

let fixed = 0;
for (const m of msgs) {
  if (!m.body) continue;
  try {
    let url = null;

    // Try parse as JSON first
    const jsonMatch = m.body.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        url = parsed.url || parsed.link || parsed.image?.link || parsed.header?.image?.link || null;
      } catch { /* not valid JSON */ }
    }

    // Fallback: regex extract URL
    if (!url) {
      const urlMatch = m.body.match(/https?:\/\/lookaside\.fbsbx\.com\/[^\s"\\}]+/);
      if (urlMatch) {
        url = urlMatch[0].replace(/\\+/g, '').replace(/"/g, '').replace(/\\/g, '');
      }
    }

    if (url) {
      db.prepare(`UPDATE messages SET type = 'image', media_url = ?, body = '' WHERE id = ?`).run(url, m.id);
      console.log(`✅ Fixed message ${m.id}`);
      fixed++;
    }
  } catch (err) {
    console.log(`⚠️ Could not fix message ${m.id}: ${err.message}`);
  }
}

console.log(`\nDone! Fixed ${fixed} out of ${msgs.length} messages.`);
db.close();
