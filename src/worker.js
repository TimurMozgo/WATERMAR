import { validateTelegram } from './auth.js';
import { ADMIN_IDS, CATEGORIES, HttpError, fail, validateProduct, validateCheckout, priceOrder } from './domain.js';
import { syncSheets } from './sheets.js';
import { sendNotifications } from './notifications.js';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const productJSON = row => ({ ...row, images: JSON.parse(row.images), active: Boolean(row.active) });
const orderJSON = row => ({ id: row.id, code: String(row.code), created_at: row.created_at, items: JSON.parse(row.items), total: row.total, status: row.status, rejection_reason: row.rejection_reason, reviewed_at: row.reviewed_at });
async function body(request, limit = 40000) {
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Пустой запрос.');
  let size = 0; const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); fail(413, 'Слишком большой запрос.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let i = 0; for (const c of chunks) { bytes.set(c, i); i += c.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, 'Некорректный JSON.'); }
}
async function rate(env, key, max, seconds = 60) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const result = await env.DB.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`${key}:${bucket}`, (bucket + 1) * seconds * 1000).first();
  if (result.count > max) fail(429, 'Слишком много запросов. Попробуйте чуть позже.');
}
const outbox = (env, entity, id) => env.DB.prepare('INSERT INTO outbox(entity,entity_id) VALUES(?,?) ON CONFLICT(entity,entity_id) DO UPDATE SET version=version+1,next_attempt=0').bind(entity, id);
export async function handle(request, env, ctx) {
  const url = new URL(request.url); const path = url.pathname; const method = request.method;
  if (path.startsWith('/media/') && method === 'GET') {
    const key = path.slice(7);
    if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) fail(404, 'Фото не найдено.');
    const stored = env.MEDIA_STORE ? await env.MEDIA_STORE.getWithMetadata(key, {type:'arrayBuffer'}) : null;
    const file = env.MEDIA_STORE ? (stored.value ? {body:stored.value,httpEtag:`"${key}"`,writeHttpMetadata:headers=>headers.set('Content-Type',stored.metadata?.contentType||'application/octet-stream')} : null) : await env.IMAGES.get(key);
    if (!file) fail(404, 'Фото не найдено.');
    const headers = new Headers({ 'Cache-Control': 'public,max-age=31536000,immutable', 'X-Content-Type-Options': 'nosniff' });
    file.writeHttpMetadata(headers); headers.set('ETag', file.httpEtag);
    return new Response(file.body, { headers });
  }
  if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (method !== 'GET' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) fail(403, 'Недопустимый источник запроса.');
  if (path === '/api/products' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM products WHERE active=1 ORDER BY created_at DESC').all();
    return json({ products: rows.results.map(productJSON), categories: CATEGORIES });
  }
  const user = await validateTelegram(request.headers.get('X-Telegram-Init-Data'), env.BOT_TOKEN);
  const admin = ADMIN_IDS.has(user.id);
  if (path === '/api/me' && method === 'GET') return json({ user, admin });
  if (path === '/api/orders' && method === 'GET') {
    const offset = Math.max(0, Math.min(1000000, parseInt(url.searchParams.get('offset') || '0', 10) || 0));
    const result = await env.DB.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?').bind(user.id, offset).all();
    return json({ orders: result.results.slice(0, 20).map(orderJSON), hasMore: result.results.length > 20 });
  }
  if (path === '/api/orders' && method === 'POST') {
    const input = validateCheckout(await body(request));
    const existing = await env.DB.prepare('SELECT * FROM orders WHERE user_id=? AND request_key=?').bind(user.id, input.requestKey).first();
    if (existing) return json({ order: orderJSON(existing) });
    await rate(env, `order:${user.id}`, 8, 300);
    const products = (await env.DB.prepare(`SELECT * FROM products WHERE id IN (${input.items.map(() => '?').join(',')})`).bind(...input.items.map(i => i.id)).all()).results;
    const { lines, total } = priceOrder(input.items, products);
    if (input.quotedTotal !== total) fail(409, 'Стоимость изменилась. Обновите страницу и проверьте корзину перед оформлением.');
    const order = { id: crypto.randomUUID(), user_id: user.id, request_key: input.requestKey, customer_name: input.name, phone: input.phone, username: user.username, items: JSON.stringify(lines), total, status: 'pending', created_at: new Date().toISOString() };
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE order_sequence SET value=value+1 WHERE singleton=1'),
        env.DB.prepare('INSERT INTO orders(id,user_id,request_key,customer_name,phone,username,items,total,status,created_at,code) VALUES(?,?,?,?,?,?,?,?,?,?,(SELECT value FROM order_sequence WHERE singleton=1))').bind(...Object.values(order)),
        outbox(env, 'order', order.id)
      ]);
    } catch (error) {
      const duplicate = await env.DB.prepare('SELECT * FROM orders WHERE user_id=? AND request_key=?').bind(user.id, input.requestKey).first();
      if (duplicate) return json({ order: orderJSON(duplicate) });
      const sequence = await env.DB.prepare('SELECT value FROM order_sequence WHERE singleton=1').first();
      if (sequence?.value >= 999999) fail(503, 'Новые заказы временно недоступны.');
      throw error;
    }
    ctx.waitUntil(syncSheets(env));
    ctx.waitUntil(sendNotifications(env));
    return json({ order: orderJSON(await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(order.id).first()) }, 201);
  }
  if (path.startsWith('/api/admin/')) {
    if (!admin) fail(403, 'У вас нет доступа к управлению магазином.');
    if(path==='/api/admin/orders'&&method==='GET') {
      const offset=Math.max(0,Math.min(1000000,parseInt(url.searchParams.get('offset')||'0',10)||0));
      const rows=(await env.DB.prepare("SELECT * FROM orders ORDER BY (status='pending') DESC,created_at DESC,id DESC LIMIT 21 OFFSET ?").bind(offset).all()).results;
      return json({orders:rows.slice(0,20).map(row=>({...orderJSON(row),customer_name:row.customer_name,phone:row.phone,user_id:row.user_id,username:row.username,reviewed_by:row.reviewed_by})),hasMore:rows.length>20});
    }
    if(/^\/api\/admin\/orders\/[a-f0-9-]+\/decision$/.test(path)&&method==='POST') {
      const id=path.split('/')[4],input=await body(request);
      if(!['confirmed','rejected'].includes(input.status))fail(400,'Недопустимый статус.');
      const reason=typeof input.reason==='string'?input.reason.trim():'';
      if(input.status==='rejected'&&(!reason||reason.length>500))fail(400,'Укажите причину отклонения: от 1 до 500 символов.');
      await rate(env,`decision:${user.id}`,30);
      const result=await env.DB.prepare("UPDATE orders SET status=?,rejection_reason=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(input.status,input.status==='rejected'?reason:'',user.id,new Date().toISOString(),id).run();
      const order=await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(id).first();
      if(!order)fail(404,'Заказ не найден.');
      if(!result.meta.changes&&(order.status!==input.status||(input.status==='rejected'&&order.rejection_reason!==reason)))fail(409,'По этому заказу уже принято решение. Обновите список.');
      ctx.waitUntil(syncSheets(env));ctx.waitUntil(sendNotifications(env));
      return json({order:orderJSON(order)});
    }
    if(path==='/api/admin/notifications'&&method==='GET') {
      const rows=(await env.DB.prepare("SELECT state,COUNT(*) count FROM notifications WHERE state<>'sent' GROUP BY state").all()).results;
      return json({configured:env.TELEGRAM_NOTIFICATIONS_ENABLED==='true'&&!env.LOCAL_PREVIEW,pending:rows.find(r=>r.state==='pending')?.count||0,failed:rows.find(r=>r.state==='failed')?.count||0});
    }
    if(path==='/api/admin/notifications/retry'&&method==='POST') {
      await rate(env,`telegram-retry:${user.id}`,2);
      await env.DB.prepare("UPDATE notifications SET state='pending',next_attempt=0 WHERE state IN ('failed','pending')").run();
      ctx.waitUntil(sendNotifications(env));return json({queued:true});
    }
    if (path === '/api/admin/products' && method === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
      return json({ products: rows.results.map(productJSON) });
    }
    if ((path === '/api/admin/products' && method === 'POST') || (/^\/api\/admin\/products\/[a-f0-9-]+$/.test(path) && method === 'PUT')) {
      await rate(env, `product:${user.id}`, 30);
      const p = validateProduct(await body(request));
      for (const image of p.images) if (!await env.DB.prepare('SELECT key FROM media WHERE key=?').bind(image.slice(7)).first()) fail(400, 'Фотография не найдена. Загрузите её снова.');
      const id = method === 'POST' ? crypto.randomUUID() : path.split('/').pop();
      const previous = method === 'PUT' ? await env.DB.prepare('SELECT id FROM products WHERE id=?').bind(id).first() : null;
      if (method === 'PUT' && !previous) fail(404, 'Товар не найден.');
      const now = new Date().toISOString();
      const statement = method === 'POST'
        ? env.DB.prepare('INSERT INTO products(id,name,description,category,price,images,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, p.name, p.description, p.category, p.price, JSON.stringify(p.images), p.active, now, now)
        : env.DB.prepare('UPDATE products SET name=?,description=?,category=?,price=?,images=?,active=?,updated_at=? WHERE id=?').bind(p.name, p.description, p.category, p.price, JSON.stringify(p.images), p.active, now, id);
      await env.DB.batch([statement, outbox(env, 'product', id)]);
      ctx.waitUntil(syncSheets(env));
      return json({ product: productJSON(await env.DB.prepare('SELECT * FROM products WHERE id=?').bind(id).first()) }, method === 'POST' ? 201 : 200);
    }
    if (path === '/api/admin/images' && method === 'POST') {
      await rate(env, `upload:${user.id}`, 30);
      const length = Number(request.headers.get('Content-Length'));
      if (!length || length > 5 * 1024 * 1024) fail(413, 'Фото должно быть не больше 5 МБ.');
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 5 * 1024 * 1024) fail(413, 'Фото должно быть не больше 5 МБ.');
      const b = new Uint8Array(buffer); const s = new TextDecoder('ascii');
      let ext, type;
      if (b[0] === 255 && b[1] === 216 && b[2] === 255) { ext = 'jpg'; type = 'image/jpeg'; }
      else if ([137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)) { ext = 'png'; type = 'image/png'; }
      else if (s.decode(b.slice(0,4)) === 'RIFF' && s.decode(b.slice(8,12)) === 'WEBP') { ext = 'webp'; type = 'image/webp'; }
      else fail(400, 'Допустимы только JPEG, PNG и WebP.');
      const key = `${crypto.randomUUID()}.${ext}`;
      if(env.MEDIA_STORE)await env.MEDIA_STORE.put(key, buffer, {metadata:{contentType:type}});
      else await env.IMAGES.put(key, buffer, { httpMetadata: { contentType: type } });
      await env.DB.prepare('INSERT INTO media(key,created_at) VALUES(?,?)').bind(key, new Date().toISOString()).run();
      return json({ url: `/media/${key}` }, 201);
    }
    if (path === '/api/admin/sync' && method === 'GET') {
      const result = await env.DB.prepare('SELECT COUNT(*) AS pending,MAX(last_error) AS last_error FROM outbox WHERE version>synced_version').first();
      return json({ ...result, configured: Boolean(env.GOOGLE_SERVICE_ACCOUNT && env.SHEET_ID) });
    }
    if (path === '/api/admin/sync' && method === 'POST') { await rate(env, `sync:${user.id}`, 2); return json(await syncSheets(env)); }
  }
  fail(404, 'Не найдено.');
}
export default {
  async fetch(request, env, ctx) {
    try { return await handle(request, env, ctx); }
    catch (error) { if (!(error instanceof HttpError)) console.error('Request failed:', error.name); return json({ error: error instanceof HttpError ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.' }, error.status || 500); }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(syncSheets(env));
    ctx.waitUntil(sendNotifications(env));
    ctx.waitUntil(env.DB.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(Date.now() - 3600000).run());
  }
};
