import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { saveMessage, messageCount, createUser, setOwner } from './db.js';
import { config } from './config.js';

/** Generates small demo media (a WAV tone + an SVG) so the UI can be tried without Boostrify. */
function ensureAssets() {
  mkdirSync('public/demo', { recursive: true });
  if (!existsSync('public/demo/voice.wav')) {
    const rate = 8000, secs = 3, n = rate * secs, buf = Buffer.alloc(44 + n * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
      const f = 440 + 120 * Math.sin(i / 2000), env = Math.sin((Math.PI * i) / n);
      buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * f * i) / rate) * 9000 * env), 44 + i * 2);
    }
    writeFileSync('public/demo/voice.wav', buf);
  }
  if (!existsSync('public/demo/photo.svg')) {
    writeFileSync('public/demo/photo.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><circle cx="470" cy="130" r="60" fill="#fff6"/><path d="M0 420 L180 220 L320 340 L440 250 L640 420Z" fill="#0008"/><text x="320" y="70" font-size="34" fill="#fff" text-anchor="middle" font-family="sans-serif">صورة تجريبية من العميل</text></svg>`);
  }
}

export function seedDemo() {
  ensureAssets();
  if (messageCount() > 0) return;
  const l = config.lines;
  const lSaudi = l[0]?.id || '966500000001';
  const lOman  = l[1]?.id || '968900000002';
  const lIraq  = l[2]?.id || '964700000003';

  const now = Date.now(), min = 60_000;
  const rows = [
    { line: lSaudi, phone: '966551234567', name: 'أحمد محمود (الرياض)', msgs: [
      ['in', 'text', 'السلام عليكم، استفسار عن التوصيل داخل الرياض', 90],
      ['out', 'text', 'وعليكم السلام يا فندم، التوصيل متاح خلال 24 ساعة 🚀', 88],
      ['in', 'image', 'ده موقع الاستلام', 40, { media_url: '/demo/photo.svg', mime: 'image/svg+xml' }],
      ['in', 'audio', '', 12, { media_url: '/demo/voice.wav', mime: 'audio/wav' }],
    ] },
    { line: lOman, phone: '96891234567', name: 'سارة البلوشي (مسقط)', msgs: [
      ['in', 'text', 'مرحبا، هل متوفر دفع عند الاستلام في مسقط؟', 300],
      ['out', 'text', 'أهلاً بك يا سارة، نعم متوفر الدفع عند الاستلام', 295],
      ['in', 'text', 'ممتاز، شكراً جزيلاً', 290],
    ] },
    { line: lIraq, phone: '9647701234567', name: 'حيدر الكرخي (بغداد)', msgs: [
      ['in', 'text', 'السلام عليكم، كم سعر المنتج بالدينار العراقي؟', 25],
      ['in', 'image', '', 24, { media_url: '/demo/photo.svg', mime: 'image/svg+xml' }],
    ] },
  ];

  let n = 0;
  // Mona has access to Saudi line only
  const mona = createUser({ username: 'mona', name: 'منى (مسؤولة السعودية)', password: '1234', role: 'agent', allowed_lines: [lSaudi] });
  // Omar has access to Oman & Iraq lines
  const omar = createUser({ username: 'omar', name: 'عمر (مسؤول عمان والعراق)', password: '1234', role: 'agent', allowed_lines: [lOman, lIraq] });

  const owners = { '966551234567': mona, '96891234567': omar }; // Hayder (Iraq) unassigned

  for (const c of rows) {
    for (const [direction, type, body, ago, extra = {}] of c.msgs) {
      saveMessage({ id: `demo_${n++}`, line: c.line, phone: c.phone, direction, type, body,
        status: direction === 'out' ? 'read' : 'sent', ts: now - ago * min, ...extra }, c.name);
    }
    if (owners[c.phone]) setOwner(c.line, c.phone, Number(owners[c.phone]));
  }
}
