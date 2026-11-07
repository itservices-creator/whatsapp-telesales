// Fix existing messages in DB that have JSON image metadata stored as body text
// Run once on the server: node --env-file=.env fix-images-db.mjs

import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DB_PATH = resolve('data/chat.db');
const db = new Database(DB_PATH);

// Find messages where body looks like JSON with lookaside URL or image mime_type
const msgs = db.prepare(`
  SELECT id, body, media_url, type FROM messages 
  WHERE body LIKE '%lookaside.fbsbx.com%' OR body LIKE '%"mime_type"%'
`).all();

console.log(`Found ${msgs.length} messages with JSON image data to fix...`);

let fixed = 0;
for (const m of msgs) {
  try {
    let jsonStr = m.body || '';
    // Try to find JSON object in the string
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try extracting URL directly
      const urlMatch = jsonStr.match(/https?:\/\/lookaside\.fbsbx\.com\/[^\s"\\}]+/);
      if (urlMatch) {
        const cleanUrl = urlMatch[0].replace(/\\+/g, '').replace(/"/g, '');
        db.prepare(`UPDATE messages SET type = 'image', media_url = ?, body = '' WHERE id = ?`).run(cleanUrl, m.id);
        console.log(`Fixed (regex) message ${m.id}`);
        fixed++;
      }
      continue;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    // Extract the URL - Boostrify uses multiple possible fields
    const url = parsed.url || parsed.link || parsed.image?.link || parsed.header?.image?.link || null;

    if (url && url.includes('lookaside.fbsbx.com')) {
      db.prepare(`UPDATE messages SET type = 'image', media_url = ?, body = '' WHERE id = ?`).run(url, m.id);
      console.log(`Fixed (JSON) message ${m.id}`);
      fixed++;
    }
  } catch (err) {
    // Try regex fallback
    const urlMatch = (m.body || '').match(/https?:\/\/lookaside\.fbsbx\.com\/[^\s"\\}]+/);
    if (urlMatch) {
      const cleanUrl = urlMatch[0].replace(/\\+/g, '').replace(/"/g, '');
      db.prepare(`UPDATE messages SET type = 'image', media_url = ?, body = '' WHERE id = ?`).run(cleanUrl, m.id);
      console.log(`Fixed (fallback) message ${m.id}`);
      fixed++;
    } else {
      console.log(`Could not fix message ${m.id}: ${err.message}`);
    }
  }
}

console.log(`\nDone! Fixed ${fixed} out of ${msgs.length} messages.`);
db.close();
