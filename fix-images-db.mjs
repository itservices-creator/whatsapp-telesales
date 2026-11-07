// Fix existing messages in DB that have JSON image metadata stored as body text
// Run once on the server: node fix-images-db.mjs

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';

const DB_PATH = resolve('data/chat.db');
const db = new Database(DB_PATH);

// Find messages where body looks like JSON with lookaside URL
const msgs = db.prepare(`
  SELECT id, body, media_url, type FROM messages 
  WHERE (body LIKE '%lookaside.fbsbx.com%' OR body LIKE '%"mime_type"%')
`).all();

console.log(`Found ${msgs.length} messages with JSON image data to fix...`);

let fixed = 0;
for (const m of msgs) {
  try {
    // The body might be JSON
    let jsonStr = m.body;
    // Sometimes it's double-encoded or has text prefix
    // Try to find JSON object in the string
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;
    
    const parsed = JSON.parse(jsonMatch[0]);
    // Extract the URL - Boostrify uses multiple possible fields
    const url = parsed.url || parsed.link || parsed.image?.link || parsed.header?.image?.link || null;
    
    if (url && url.includes('lookaside.fbsbx.com')) {
      db.prepare(`
        UPDATE messages SET type = 'image', media_url = ?, body = '' WHERE id = ?
      `).run(url, m.id);
      console.log(`Fixed message ${m.id}: extracted URL from JSON body`);
      fixed++;
    } else if (m.body.includes('lookaside.fbsbx.com')) {
      // Try to extract URL directly from string
      const urlMatch = m.body.match(/https?:\/\/lookaside\.fbsbx\.com\/[^\s"\\}]+/);
      if (urlMatch) {
        const cleanUrl = urlMatch[0].replace(/\\+/g, '').replace(/"/g, '');
        db.prepare(`
          UPDATE messages SET type = 'image', media_url = ?, body = '' WHERE id = ?
        `).run(cleanUrl, m.id);
        console.log(`Fixed message ${m.id}: extracted URL via regex`);
        fixed++;
      }
    }
  } catch (err) {
    console.log(`Could not parse message ${m.id}: ${err.message}`);
  }
}

console.log(`\nDone! Fixed ${fixed} out of ${msgs.length} messages.`);
db.close();
