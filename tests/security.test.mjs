import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateTelegram } from '../src/auth.js';
import { ADMIN_IDS, validateCheckout, validateProduct, priceOrder } from '../src/domain.js';
import worker from '../src/worker.js';
import { database } from '../scripts/sqlite-adapter.mjs';
const token='test-secret';
function signed(id=123,date=Math.floor(Date.now()/1000)) {
 const p=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id,first_name:'Test'})});
 const text=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
 p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(text).digest('hex'));return p.toString();
}
test('Telegram HMAC validates the signed user',async()=>assert.equal((await validateTelegram(signed(6088315974),token)).id,'6088315974'));
test('Both requested admin IDs and nobody else are allowed',()=>{assert.ok(ADMIN_IDS.has('394814448'));assert.ok(ADMIN_IDS.has('6088315974'));assert.equal(ADMIN_IDS.size,2);assert.ok(!ADMIN_IDS.has('123'));});
test('Tampered, expired, future and duplicate auth data are rejected',async()=>{
 await assert.rejects(()=>validateTelegram(signed().replace('123','394814448'),token),{status:401});
 await assert.rejects(()=>validateTelegram(signed(123,1),token),{status:401});
 await assert.rejects(()=>validateTelegram(signed(123,Math.floor(Date.now()/1000)+120),token),{status:401});
 await assert.rejects(()=>validateTelegram(signed()+'&user=%7B%7D',token),{status:401});
 await assert.rejects(()=>validateTelegram('',token),{status:401});
});
test('Checkout rejects empty carts, duplicate products and invalid phones',()=>{
 const base={name:'Test User',phone:'+380501234567',requestKey:'12345678-12345678',quotedTotal:10000,items:[{id:'p',count:1}]};
 assert.equal(validateCheckout(base).items.length,1);
 for(const patch of [{items:[]},{items:[{id:'p',count:-1}]},{items:[{id:'p',count:1},{id:'p',count:2}]},{phone:'abc'},{phone:'+38012345678'},{phone:'+3801234567890'},{phone:'+48123456789'},{requestKey:'x'}])assert.throws(()=>validateCheckout({...base,...patch}));
});
test('Products require safe local images and valid money/category',()=>{
 const base={name:'Filter',description:'Water filter',category:'Оборудование',price:10000,images:['/media/aaaaaaaa-aaaa.webp']};
 assert.equal(validateProduct(base).price,10000);
 for(const patch of [{price:-1},{price:1.5},{images:[]},{images:['javascript:alert(1)']},{category:'Other'},{images:Array(9).fill('/media/aaa.webp')}])assert.throws(()=>validateProduct({...base,...patch}));
});
test('Order price comes only from the database, not the browser',()=>{
 const result=priceOrder([{id:'p',count:2,price:1}],[{id:'p',name:'Filter',price:19999,active:1,images:'[]'}]);assert.equal(result.total,39998);
 assert.throws(()=>priceOrder([{id:'p',count:1}],[{id:'p',active:0}]));
});
test('API: durable orders, idempotency, isolation, admin access and outbox',async()=>{
 const DB=database();DB.exec(await readFile(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 DB.exec(await readFile(new URL('../migrations/0002_order_codes.sql',import.meta.url),'utf8'));
 DB.exec(await readFile(new URL('../migrations/0003_order_workflow.sql',import.meta.url),'utf8'));
 await DB.prepare('INSERT INTO products(id,name,description,category,price,images,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').bind('p','Filter','Desc','Оборудование',12345,'[]','2026-01-01','2026-01-01').run();
 const env={DB,BOT_TOKEN:token};const ctx={waitUntil:p=>p.catch(()=>{})};
 const call=(path,user=123,method='GET',data)=>worker.fetch(new Request('https://watermar.test/api'+path,{method,headers:{'X-Telegram-Init-Data':signed(user),'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env,ctx);
 assert.equal((await call('/admin/products')).status,403);
 assert.equal((await call('/admin/products',6088315974)).status,200);
 const data={name:'Client',phone:'+380501234567',requestKey:'test-idempotency-001',quotedTotal:24690,items:[{id:'p',count:2,price:1}],total:1,user_id:'999'};
 assert.equal((await call('/orders',123,'POST',{...data,quotedTotal:1})).status,409);
 const first=await call('/orders',123,'POST',data);assert.equal(first.status,201);const order=(await first.json()).order;assert.equal(order.total,24690);
 assert.match(order.code,/^[1-9]\d{5}$/);
 const retry=await call('/orders',123,'POST',data);assert.equal(retry.status,200);const repeated=(await retry.json()).order;assert.equal(repeated.id,order.id);assert.equal(repeated.code,order.code);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM orders').first()).n,1);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM outbox WHERE entity='order' AND version>synced_version").first()).n,1);
 assert.equal((await (await call('/orders',999)).json()).orders.length,0);
 assert.equal((await (await call('/orders',123)).json()).orders.length,1);
 const badOrigin=await worker.fetch(new Request('https://watermar.test/api/orders',{method:'POST',headers:{Origin:'https://evil.test','X-Telegram-Init-Data':signed()},body:JSON.stringify(data)}),env,ctx);assert.equal(badOrigin.status,403);
 const noAuth=await worker.fetch(new Request('https://watermar.test/api/me'),env,ctx);assert.equal(noAuth.status,401);
 const failEnv={...env,DB:{...DB,batch:async()=>{throw new Error('database down');}}};
 const failed=await worker.fetch(new Request('https://watermar.test/api/orders',{method:'POST',headers:{'X-Telegram-Init-Data':signed()},body:JSON.stringify({...data,requestKey:'test-idempotency-002'})}),failEnv,ctx);assert.equal(failed.status,500);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM orders').first()).n,1);
 const second=await call('/orders',123,'POST',{...data,requestKey:'another-request-003'});assert.equal(second.status,201);const next=(await second.json()).order;assert.match(next.code,/^[1-9]\d{5}$/);assert.notEqual(next.code,order.code);
 await assert.rejects(()=>DB.prepare('UPDATE orders SET code=? WHERE id=?').bind(Number(next.code),order.id).run());
 await DB.prepare('UPDATE order_sequence SET value=999999').run();
 assert.equal((await call('/orders',123,'POST',{...data,requestKey:'another-request-004'})).status,503);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM orders').first()).n,2);DB.close();
});
