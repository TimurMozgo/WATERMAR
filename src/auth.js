import { fail } from './domain.js';
const enc = new TextEncoder();
async function hmac(key, message) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}
export async function validateTelegram(raw, token, now = Date.now()) {
  if (!token) fail(503, 'Подключение к Telegram ещё не настроено.');
  if (!raw || raw.length > 12000) fail(401, 'Откройте приложение через Telegram.');
  const params = new URLSearchParams(raw);
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) fail(401, 'Некорректная сессия Telegram.');
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) fail(401, 'Некорректная сессия Telegram.');
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac(enc.encode('WebAppData'), token);
  const expected = await hmac(secret, check);
  let mismatch = 0;
  for (let i = 0; i < 32; i++) mismatch |= expected[i] ^ parseInt(hash.slice(i * 2, i * 2 + 2), 16);
  if (mismatch) fail(401, 'Не удалось подтвердить сессию Telegram.');
  const date = Number(params.get('auth_date'));
  if (!Number.isFinite(date) || date <= 0 || date > now / 1000 + 60 || now / 1000 - date > 86400) fail(401, 'Сессия истекла. Закройте и снова откройте приложение.');
  let user;
  try { user = JSON.parse(params.get('user')); } catch { fail(401, 'Некорректный профиль Telegram.'); }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) fail(401, 'Некорректный профиль Telegram.');
  return { id: String(user.id), first_name: String(user.first_name || ''), last_name: String(user.last_name || ''), username: String(user.username || '') };
}
