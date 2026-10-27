// A durable outbox retries Google failures. All values use RAW, never formulas.
const TABS = { product: 'Товары TMA', order: 'Заказы TMA' };
const HEADERS = {
  product: ['ID', 'Название', 'Описание', 'Категория', 'Цена, ₴', 'Фотографии JSON', 'Активен', 'Создан', 'Обновлён'],
  order: ['ID', 'Дата', 'Telegram ID', 'Username', 'Клиент', 'Телефон', 'Товары', 'Сумма, ₴', 'Статус', 'Состав JSON', 'Код заказа', 'Причина отклонения', 'Решение принял, Telegram ID', 'Дата решения']
};
let cachedToken;
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
async function token(env) {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  const account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = b64(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = b64(enc.encode(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${payload}`)));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${payload}.${signature}` }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Google auth: ${response.status}`);
  const result = await response.json();
  cachedToken = { value: result.access_token, expires: Date.now() + 3300000 };
  return cachedToken.value;
}
async function google(env, path, body) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await token(env)}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) { if (response.status === 401) cachedToken = null; throw new Error(`Google Sheets: ${response.status}`); }
  return response.json();
}
export async function syncSheets(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT || !env.SHEET_ID) return { configured: false };
  const now = Date.now(); const owner = crypto.randomUUID();
  const lock = await env.DB.prepare("INSERT INTO leases(name,owner,expires) VALUES('sheets',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE leases.expires < ?").bind(owner, now + 180000, now).run();
  if (!lock.meta.changes) return { busy: true };
  let jobs = [];
  try {
    jobs = (await env.DB.prepare('SELECT * FROM outbox WHERE synced_version < version AND next_attempt <= ? ORDER BY id LIMIT 20').bind(now).all()).results;
    if (!jobs.length) return { synced: 0 };
    const maps = {};
    for (const entity of new Set(jobs.map(j => j.entity))) {
      const result = await google(env, `/values/${encodeURIComponent(`'${TABS[entity]}'!A1:A10000`)}`);
      const values = result.values || [];
      if (values[0]?.[0] !== HEADERS[entity][0]) throw new Error(`Проверьте заголовок листа ${TABS[entity]}`);
      maps[entity] = { ids: new Map(values.slice(1).map((r, i) => [String(r[0]), i + 2])), next: Math.max(values.length + 1, 2) };
    }
    const data = [];
    for (const job of jobs) {
      const item = await env.DB.prepare(`SELECT * FROM ${job.entity === 'product' ? 'products' : 'orders'} WHERE id=?`).bind(job.entity_id).first();
      if (!item) throw new Error('Outbox entity missing');
      const map = maps[job.entity];
      const row = map.ids.get(item.id) || map.next++;
      if (row > 10000) throw new Error('Лист достиг 9999 записей. Требуется расширение диапазона синхронизации.');
      const values = job.entity === 'product'
        ? [item.id, item.name, item.description, item.category, item.price / 100, item.images, Boolean(item.active), item.created_at, item.updated_at]
        : [item.id, item.created_at, item.user_id, item.username, item.customer_name, item.phone, JSON.parse(item.items).map(p => `${p.name} × ${p.count}`).join('; '), item.total / 100, ({pending:'В ожидании',confirmed:'Подтверждён',rejected:'Отклонён'})[item.status] || item.status, item.items, String(item.code), item.rejection_reason || '', item.reviewed_by || '', item.reviewed_at || ''];
      data.push({ range: `'${TABS[job.entity]}'!A${row}`, values: [values] });
    }
    await google(env, '/values:batchUpdate', { valueInputOption: 'RAW', data });
    await env.DB.batch(jobs.map(j => env.DB.prepare('UPDATE outbox SET synced_version=?,attempts=0,next_attempt=0,last_error=NULL WHERE id=?').bind(j.version, j.id)));
    return { synced: jobs.length };
  } catch (error) {
    await env.DB.batch(jobs.map(j => env.DB.prepare('UPDATE outbox SET attempts=attempts+1,next_attempt=?,last_error=? WHERE id=?').bind(now + Math.min(3600000, 30000 * 2 ** Math.min(j.attempts, 7)), String(error.message).slice(0, 180), j.id)));
    return { error: 'Синхронизация отложена. Данные сохранены в базе.' };
  } finally {
    await env.DB.prepare("DELETE FROM leases WHERE name='sheets' AND owner=?").bind(owner).run();
  }
}
