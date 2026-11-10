const e = process.env;

const DEFAULT_WAFY_LINES = [
  {
    id: '191',
    name: 'wafyStore (+966 58 073 2762)',
    phone: '966580732762',
    phoneNumberId: '1182513001614158',
    appKey: e.BOOSTRIFY_APP_KEY_191 || e.BOOSTRIFY_APP_KEY || 'key-6aebbc30db4a3',
  },
  {
    id: '263',
    name: 'wafyStore2 (+966 59 538 5258)',
    phone: '966595385258',
    phoneNumberId: '1476733572184785',
    appKey: e.BOOSTRIFY_APP_KEY_263 || 'key-6af385aa385b4',
  },
];

// BOOSTRIFY_LINES="191:wafyStore (+966 58 073 2762),263:wafyStore2 (+966 59 538 5258)"
const parsedEnvLines = (e.BOOSTRIFY_LINES || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
  .map((s) => {
    const i = s.indexOf(':');
    const id = i < 0 ? s : s.slice(0, i).trim();
    const rawName = i < 0 ? s : s.slice(i + 1).trim();
    const known = DEFAULT_WAFY_LINES.find((d) => d.id === id);
    if (known) {
      // If .env has the old default "wafyStore 💬", upgrade to include phone number for clarity
      const name = (rawName === 'wafyStore 💬' || !rawName) ? known.name : rawName;
      return { ...known, name };
    }
    return { id, name: rawName || id };
  });

const lines = [...parsedEnvLines];
for (const defLine of DEFAULT_WAFY_LINES) {
  if (!lines.some((l) => String(l.id) === String(defLine.id))) {
    lines.push(defLine);
  }
}

export function resolveLineId(raw) {
  if (!raw) return lines[0]?.id || '191';
  const s = String(raw).trim();
  const cleanDigits = s.replace(/\D/g, '');
  for (const l of lines) {
    if (
      String(l.id) === s ||
      (l.phoneNumberId && String(l.phoneNumberId) === s) ||
      (l.appKey && String(l.appKey) === s) ||
      (l.phone && cleanDigits && String(l.phone) === cleanDigits)
    ) {
      return String(l.id);
    }
  }
  return s;
}

export function getLineAppKey(lineId) {
  const resolved = resolveLineId(lineId);
  const found = lines.find((l) => String(l.id) === String(resolved));
  return found?.appKey || e.BOOSTRIFY_APP_KEY || e.BOOSTRIFY_API_KEY || 'key-6aebbc30db4a3';
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
    appKey: e.BOOSTRIFY_APP_KEY || e.BOOSTRIFY_API_KEY || 'key-6aebbc30db4a3',
    authKey: e.BOOSTRIFY_AUTH_KEY || 'l5GDSZqzQmsfFPfcsRVMQR0Eo1jee0ik305',
    email: e.BOOSTRIFY_EMAIL || 'itservices@taager.com',
    password: e.BOOSTRIFY_PASSWORD || 'T@Ag^er@2028#',
    phoneId: e.BOOSTRIFY_PHONE_ID || '191',
    sendPath: e.BOOSTRIFY_SEND_PATH || '/whatsapp/message',
    historyPath: e.BOOSTRIFY_HISTORY_PATH || '/whatsapp/v1/conversations',
    mediaPath: e.BOOSTRIFY_MEDIA_PATH || '/{id}',
  },
};
