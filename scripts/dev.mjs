// Local preview only. This file is never bundled into the production Worker.
import http from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { database } from './sqlite-adapter.mjs';
import worker from '../src/worker.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = path.join(root, 'work');await mkdir(path.join(work,'media'),{recursive:true});
const db = database(path.join(work,'preview.sqlite'));
if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").first()) {
  db.exec(await readFile(path.join(root,'migrations/0001_initial.sql'),'utf8'));
  const now=new Date().toISOString();
  const fixtures=[
    {id:'10000000-0000-4000-8000-000000000001',name:'Waterdrop G2P600',description:'Компактная форма. Чистая вода.\n\nСистема обратного осмоса для установки под мойкой. Лаконичный белый корпус и отдельный кран для питьевой воды.\n\nДемонстрационная карточка: цена и ассортимент приведены для просмотра дизайна.',price:3500000,category:'Оборудование',image:'1.webp'},
    {id:'10000000-0000-4000-8000-000000000002',name:'Waterdrop G3P800',description:'Технологии в каждой детали.\n\nСистема очистки воды в современном корпусе с отдельным краном. Продуманное решение для кухни.\n\nДемонстрационная карточка: цена и ассортимент приведены для просмотра дизайна.',price:4500000,category:'Оборудование',image:'2.webp'},
    {id:'10000000-0000-4000-8000-000000000003',name:'Waterdrop X12',description:'Минимализм с большим смыслом.\n\nСистема обратного осмоса с лаконичным дизайном. Белый корпус и металлический кран сочетаются с современным интерьером.\n\nДемонстрационная карточка: цена и ассортимент приведены для просмотра дизайна.',price:6200000,category:'Оборудование',image:'3.webp'}
  ];
  for(const p of fixtures){
    const key=`${p.id.replace('10000000','20000000')}.webp`;await writeFile(path.join(work,'media',key),await readFile(path.join(root,'public/img',p.image)));
    await db.prepare('INSERT INTO media(key,created_at) VALUES(?,?)').bind(key,now).run();
    await db.prepare('INSERT INTO products(id,name,description,category,price,images,active,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)').bind(p.id,p.name,p.description,p.category,p.price,JSON.stringify([`/media/${key}`]),now,now).run();
  }
}
if (!(await db.prepare("SELECT name FROM pragma_table_info('orders') WHERE name='code'").first())) {
  db.exec(await readFile(path.join(root,'migrations/0002_order_codes.sql'),'utf8'));
}
if (!(await db.prepare("SELECT name FROM pragma_table_info('orders') WHERE name='rejection_reason'").first())) {
  db.exec(await readFile(path.join(root,'migrations/0003_order_workflow.sql'),'utf8'));
}
const token='LOCAL_PREVIEW_NOT_A_REAL_TELEGRAM_TOKEN';
function initData(){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:394814448,first_name:'Демо',last_name:'профиль',username:'watermar_preview'})});const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const key=createHmac('sha256','WebAppData').update(token).digest();p.set('hash',createHmac('sha256',key).update(check).digest('hex'));return p.toString();}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const env={DB:db,LOCAL_PREVIEW:true,BOT_TOKEN:token,IMAGES:{
  async get(key){try{const bytes=await readFile(path.join(work,'media',key));return{body:bytes,httpEtag:'"local"',writeHttpMetadata:h=>h.set('Content-Type',mime[path.extname(key)]||'application/octet-stream')};}catch{return null;}},
  async put(key,buffer){await writeFile(path.join(work,'media',key),new Uint8Array(buffer));}
},ASSETS:{async fetch(request){let name=decodeURIComponent(new URL(request.url).pathname);if(name==='/')name='/index.html';const file=path.resolve(root,'public','.'+name);if(!file.startsWith(path.join(root,'public')+path.sep))return new Response('Not found',{status:404});try{return new Response(await readFile(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}};
const server=http.createServer(async(req,res)=>{
  try{
    if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||'')){res.writeHead(403);res.end('Local preview only');return;}
    const url=`http://${req.headers.host}${req.url}`;
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>6*1024*1024){res.writeHead(413);res.end();return;}chunks.push(c);}
    const headers=new Headers(req.headers);headers.set('X-Telegram-Init-Data',initData());
    const request=new Request(url,{method:req.method,headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Buffer.concat(chunks)}:{})});
    let result=await worker.fetch(request,env,{waitUntil:p=>p.catch(()=>{})});
    if(new URL(url).pathname==='/api/me'&&result.ok)result=Response.json({...await result.json(),preview:true});
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch(e){console.error(e);res.writeHead(500);res.end('Preview error');}
});
const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`WATERMAR preview: http://127.0.0.1:${port}\nTest data only; nothing is sent to Google Sheets.`));
