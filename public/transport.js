import { APPS_SCRIPT_URL } from './config.js';
const photos = new Map();
const pendingPhotos = new Map();
export function imageUrl(path) {
  if (photos.has(path)) return photos.get(path);
  return /^\/img\/[\w.-]+$/.test(path || '') ? new URL('.' + path, import.meta.url).href : new URL('./favicon.svg', import.meta.url).href;
}
async function request(path, method, data, initData) {
  const [pathname, query = ''] = path.split('?');
  let response;
  try {
    response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST', credentials: 'omit', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ path: pathname, method, data, initData, offset: new URLSearchParams(query).get('offset') || '0' }),
      signal: AbortSignal.timeout(60000)
    });
  } catch { throw new Error('Нет ответа от магазина. Повторите попытку: сохранённый заказ не будет продублирован.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('Сервер магазина временно недоступен.'); }
  if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось выполнить запрос.');
  return result.data;
}
async function photo(path) {
  if (photos.has(path)) return;
  if (!pendingPhotos.has(path)) pendingPhotos.set(path, (async () => {
    const result = await request(path, 'GET', {}, '');
    if (!['image/png','image/jpeg','image/webp'].includes(result.type)) throw new Error('Неизвестный формат фото');
    const bytes = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
    photos.set(path, URL.createObjectURL(new Blob([bytes], { type: result.type })));
  })().finally(() => pendingPhotos.delete(path)));
  return pendingPhotos.get(path);
}
export async function storeApi(path, { method = 'GET', data = {}, file } = {}, initData = '') {
  if (file) {
    if (file.size > 2 * 1024 * 1024) throw new Error('Фотография должна быть меньше 2 МБ.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = ''; for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    data = { base64: btoa(binary) };
  }
  const result = await request('/api' + path, method, data, initData);
  const images = new Set();
  function collect(value) {
    if (typeof value === 'string' && /^\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value)) images.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  }
  collect(result);
  // A broken photo must not turn a successfully saved order into an error.
  const queue = [...images];
  await Promise.all(Array.from({length:Math.min(3,queue.length)}, async () => {
    while(queue.length) { try { await photo(queue.shift()); } catch { /* Render fallback. */ } }
  }));
  return result;
}
