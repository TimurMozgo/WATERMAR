import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {database} from '../scripts/sqlite-adapter.mjs';
import worker from '../src/worker.js';
import {sendNotifications,notificationText} from '../src/notifications.js';
async function setup(){const DB=database();for(const f of ['0001_initial','0002_order_codes','0003_order_workflow'])DB.exec(await readFile(new URL('../migrations/'+f+'.sql',import.meta.url),'utf8'));await DB.prepare("INSERT INTO products VALUES('p','Осмос','Desc','Оборудование',10000,'[]',1,'2026','2026')").run();return DB;}
const token='test';
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Тест'})});const text=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(text).digest('hex'));return p.toString();}
function api(DB){return (path,user=123,method='GET',data)=>worker.fetch(new Request('https://test/api'+path,{method,headers:{'X-Telegram-Init-Data':auth(user)},...(data?{body:JSON.stringify(data)}:{})}),{DB,BOT_TOKEN:token},{waitUntil:p=>p.catch(()=>{})});}
const order={name:'Клиент',phone:'+380501234567',items:[{id:'p',count:1}],quotedTotal:10000,requestKey:'workflow-test-request'};
test('Workflow: pending, admin-only decisions, required reason, immutable decision, audit and queues',async()=>{
 const DB=await setup(),call=api(DB);
 try{
 const first=await call('/orders',123,'POST',order);assert.equal(first.status,201);const o=(await first.json()).order;assert.equal(o.status,'pending');
 await call('/orders',123,'POST',order);assert.equal((await DB.prepare('SELECT COUNT(*) n FROM notifications').first()).n,3);
 const path='/admin/orders/'+o.id+'/decision';
 assert.equal((await call('/admin/orders')).status,403);assert.equal((await call(path,123,'POST',{status:'confirmed'})).status,403);
 assert.equal((await call(path,394814448,'POST',{status:'rejected',reason:' '})).status,400);
 assert.equal((await call(path,394814448,'POST',{status:'bogus'})).status,400);
 assert.equal((await call(path,394814448,'POST',{status:'rejected',reason:'Товару немає в наявності'})).status,200);
 assert.equal((await call(path,6088315974,'POST',{status:'confirmed'})).status,409);
 assert.equal((await call(path,394814448,'POST',{status:'rejected',reason:'Товару немає в наявності'})).status,200);
 const saved=(await (await call('/orders')).json()).orders[0];assert.equal(saved.status,'rejected');assert.equal(saved.rejection_reason,'Товару немає в наявності');
 const row=await DB.prepare('SELECT * FROM orders WHERE id=?').bind(o.id).first();assert.equal(row.reviewed_by,'394814448');assert.ok(row.reviewed_at);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM notifications').first()).n,4);assert.equal((await DB.prepare('SELECT version FROM outbox').first()).version,2);
 const next=(await (await call('/orders',123,'POST',{...order,requestKey:'second-workflow-order'})).json()).order;
 assert.equal((await call('/admin/orders/'+next.id+'/decision',6088315974,'POST',{status:'confirmed'})).status,200);
 assert.equal((await DB.prepare("SELECT COUNT(*) n FROM notifications WHERE event='confirmed'").first()).n,1);
 }finally{DB.close();}
});
test('Telegram queue: no preview delivery, retry 429, ordered events, terminal failure, sent jobs not repeated',async()=>{
 const DB=await setup(),call=api(DB);const o=(await (await call('/orders',123,'POST',order)).json()).order;
 await call('/admin/orders/'+o.id+'/decision',394814448,'POST',{status:'confirmed'});
 const original=globalThis.fetch;let sent=[];let limited=true;
 globalThis.fetch=async(_url,options)=>{const p=JSON.parse(options.body);sent.push(p);if(p.chat_id==='123'&&limited){limited=false;return Response.json({ok:false,error_code:429,parameters:{retry_after:60}},{status:429});}if(p.chat_id==='6088315974')return Response.json({ok:false,error_code:403},{status:403});return Response.json({ok:true,result:{message_id:42}});};
 const env={DB,BOT_TOKEN:token,TELEGRAM_NOTIFICATIONS_ENABLED:'true'};
 try{
 assert.equal((await sendNotifications({...env,LOCAL_PREVIEW:true})).configured,false);assert.equal(sent.length,0);
 await sendNotifications(env);assert.equal(sent.length,3);assert.equal((await DB.prepare("SELECT state FROM notifications WHERE recipient='6088315974'").first()).state,'failed');
 await sendNotifications(env);assert.equal(sent.length,3);
 await DB.prepare('UPDATE notifications SET next_attempt=0').run();await sendNotifications(env);assert.equal(sent.length,4);assert.match(sent.at(-1).text,/отримано/);
 await sendNotifications(env);assert.equal(sent.length,5);assert.match(sent.at(-1).text,/прийнято/);
 await sendNotifications(env);assert.equal(sent.length,5);
 }finally{globalThis.fetch=original;DB.close();}
});
test('Owner message fits Telegram length with a maximum cart and uses literal user text',()=>{
 const text=notificationText('owner_new',{code:'123456',customer_name:'<name>',phone:'+380501234567',user_id:'123',username:'test',items:JSON.stringify(Array.from({length:50},()=>({name:'Я'.repeat(150),count:99}))),total:10000});assert.ok(text.length<=4096);assert.match(text,/ещё позиций/);assert.match(text,/<name>/);
});
test('Free KV photo storage preserves binary data, MIME, and missing-file response',async()=>{
 const DB=await setup();const values=new Map();const env={DB,BOT_TOKEN:token,MEDIA_STORE:{async put(key,value,options){values.set(key,{value,metadata:options.metadata});},async getWithMetadata(key){return values.get(key)||{value:null,metadata:null};}}};
 try {
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0]);
 const uploaded=await worker.fetch(new Request('https://test/api/admin/images',{method:'POST',headers:{'X-Telegram-Init-Data':auth(394814448),'Content-Length':String(bytes.length)},body:bytes}),env,{});assert.equal(uploaded.status,201);const {url}=await uploaded.json();
 const image=await worker.fetch(new Request('https://test'+url),env,{});assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),bytes);
 assert.equal((await worker.fetch(new Request('https://test/media/aaaa.png'),env,{})).status,404);
 }finally{DB.close();}
});
