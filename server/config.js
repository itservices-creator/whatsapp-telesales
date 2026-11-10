const e = process.env;

// BOOSTRIFY_LINES="966500000001:السعودية 🇸🇦,968900000002:عمان 🇴🇲,964700000003:العراق 🇮🇶"  (phoneId:label)
const lines = (e.BOOSTRIFY_LINES || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
  .map((s) => { const i = s.indexOf(':'); return i < 0 ? { id: s, name: s } : { id: s.slice(0, i), name: s.slice(i + 1) }; });
if (!lines.length) {
  lines.push(
    { id: '966500000001', name: 'السعودية 🇸🇦' },
    { id: '968900000002', name: 'عمان 🇴🇲' },
    { id: '964700000003', name: 'العراق 🇮🇶' },
  );
}

export const config = {
  port: Number(e.PORT || 3000),
  demo: e.DEMO === '1',
  adminPassword: e.ADMIN_PASSWORD || e.STAFF_PASSWORD || 'change-me',
  lines,
  publicBaseUrl: (e.PUBLIC_BASE_URL || `http://localhost:${e.PORT || 3000}`).replace(/\/$/, ''),
  staffPassword: e.STAFF_PASSWORD || 'change-me',
  webhook: {
    verifyToken: e.WEBHOOK_VERIFY_TOKEN || 'change-me-verify-token',
    appSecret: e.WEBHOOK_APP_SECRET || '',
  },
  boostrify: {
    base: (e.BOOSTRIFY_API_BASE || 'https://boostrify.pro/api').replace(/\/$/, ''),
    appKey: e.BOOSTRIFY_APP_KEY || e.BOOSTRIFY_API_KEY || '',
    authKey: e.BOOSTRIFY_AUTH_KEY || '',
    email: e.BOOSTRIFY_EMAIL || 'itservices@taager.com',
    password: e.BOOSTRIFY_PASSWORD || 'P@$$w000rd@2028#',
    phoneId: e.BOOSTRIFY_PHONE_ID || '',
    sendPath: e.BOOSTRIFY_SEND_PATH || '/whatsapp/message',
    historyPath: e.BOOSTRIFY_HISTORY_PATH || '/whatsapp/v1/conversations',
    mediaPath: e.BOOSTRIFY_MEDIA_PATH || '/{id}',
  },
};
