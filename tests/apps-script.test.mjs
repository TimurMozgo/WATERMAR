import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHmac,randomUUID} from 'node:crypto';

const token='test-token';
function signed(id=123){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Тест',username:'test'})});const text=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(text).digest('hex'));return p.toString();}
async function harness(){
 const tables=new Map([['Товары TMA',[['p','Фильтр','Описание','Оборудование',100,'[]',true,'2026','2026']]],['Заказы TMA',[]],['Медиа TMA',[]]]),props=new Map([['BOT_TOKEN',token],['GATEWAY_SECRET','gateway-test-secret']]),cache=new Map(),writes=[];
 let locked=false,deny=false,failWrite=false,loseResponse=false,telegram=[];
 const context=vm.createContext({console,Date,JSON,Intl,Set,Map,Number,String,Array,Math,Error,decodeURIComponent,
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)})},
 CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
 LockService:{getScriptLock:()=>({tryLock:()=>{if(deny||locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
 Utilities:{getUuid:randomUUID,newBlob:value=>({getBytes:()=>Array.from(Buffer.from(value))}),computeHmacSha256Signature:(value,key)=>Array.from(createHmac('sha256',Buffer.from(key)).update(Buffer.from(value)).digest()),base64Decode:v=>Array.from(Buffer.from(v,'base64')),base64Encode:v=>Buffer.from(v).toString('base64')},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},
 Sheets:{Spreadsheets:{Values:{get:(_id,range)=>({values:structuredClone(tables.get(range.match(/^'(.+)'!/)[1]))}),update:(data,_id,range,options)=>{if(failWrite)throw Error('write failed');assert.equal(options.valueInputOption,'RAW');const tab=range.match(/^'(.+)'!/)[1],n=Number(range.match(/A(\d+)$/)[1]);tables.get(tab)[n-2]=structuredClone(data.values[0]);writes.push(range);if(loseResponse){loseResponse=false;throw Error('response lost');}}}}},
 UrlFetchApp:{fetch:(_url,options)=>{telegram.push(JSON.parse(options.payload));return {getContentText:()=>JSON.stringify({ok:true,result:{message_id:telegram.length}})};}}
 });
 for(const f of ['Domain','Messages','Auth','Code','SetupAndDelivery'])vm.runInContext(await readFile(new URL('../apps-script/'+f+'.gs',import.meta.url),'utf8'),context,{filename:f+'.gs'});
 return {tables,props,writes,telegram,context,setDeny:v=>deny=v,setFail:v=>failWrite=v,setLose:v=>loseResponse=v,call:(path,method='GET',data={},id=123,extra={})=>context.doPost({postData:{contents:JSON.stringify({secret:'gateway-test-secret',path,method,data,initData:signed(id),...extra})}})};
}
const checkout={name:'=HYPERLINK("x")',phone:'+380501234567',requestKey:'apps-script-test-key-001',quotedTotal:10000,items:[{id:'p',count:1}]};
test('Apps Script: real Telegram HMAC, admin isolation, RAW writes and durable idempotency',async()=>{
 const h=await harness();assert.equal(h.call('/api/me').data.user.id,'123');assert.equal(h.call('/api/me','GET',{},123,{initData:signed().replace('123','394814448')}).status,401);assert.equal(h.call('/api/me','GET',{},123,{secret:undefined}).ok,true);assert.equal(h.call('/api/orders','POST',checkout,123,{initData:''}).status,401);assert.equal(h.call('/api/admin/orders').status,403);
 assert.equal(h.call('/api/orders','POST',{...checkout,quotedTotal:1}).status,409);
 h.setLose(true);assert.equal(h.call('/api/orders','POST',checkout).ok,false);
 const retry=h.call('/api/orders','POST',checkout);assert.equal(retry.ok,true);assert.equal(retry.data.order.code,'100000');assert.equal(h.tables.get('Заказы TMA').length,1);assert.equal(h.tables.get('Заказы TMA')[0][4],checkout.name);assert.equal(JSON.parse(h.tables.get('Заказы TMA')[0][15]).length,3);
 assert.equal(h.call('/api/orders','GET',{},999).data.orders.length,0);
 h.setDeny(true);assert.equal(h.call('/api/orders').status,503);h.setDeny(false);
 h.setFail(true);assert.equal(h.call('/api/orders','POST',{...checkout,requestKey:'another-script-key'}).ok,false);h.setFail(false);assert.equal(h.tables.get('Заказы TMA').length,1);
 const next=h.call('/api/orders','POST',{...checkout,requestKey:'another-script-key'}).data.order;assert.notEqual(next.code,retry.data.order.code);
});
test('Apps Script: decisions require admin and reason; decision and message commit together',async()=>{
 const h=await harness(),o=h.call('/api/orders','POST',checkout).data.order,path='/api/admin/orders/'+o.id+'/decision';
 assert.equal(h.call(path,'POST',{status:'confirmed'}).status,403);
 assert.equal(h.call(path,'POST',{status:'rejected',reason:' '},394814448).status,400);
 const reason='Нет товара в наличии';const decision=h.call(path,'POST',{status:'rejected',reason},394814448);assert.equal(decision.data.order.rejection_reason,reason);
 assert.equal(h.call(path,'POST',{status:'confirmed'},6088315974).status,409);
 assert.equal(h.call(path,'POST',{status:'rejected',reason},394814448).ok,true);
 const row=h.tables.get('Заказы TMA')[0];assert.equal(row[12],'394814448');assert.equal(JSON.parse(row[15]).length,4);
 h.context.deliverNotifications();assert.equal(h.telegram.length,0);
 h.props.set('NOTIFICATIONS_ENABLED','true');h.context.deliverNotifications();assert.equal(h.telegram.length,4);assert.match(h.telegram[0].text,/отримано/);assert.match(h.telegram[1].text,/Новая заявка/);assert.match(h.telegram[3].text,/відхилено/);assert.ok(h.telegram[3].text.includes(reason));h.context.deliverNotifications();assert.equal(h.telegram.length,4);
});
test('Apps Script: product validation and hidden catalogue state',async()=>{
 const h=await harness();h.tables.get('Медиа TMA').push(['aaaa-bbbb.webp','file-id','image/webp','2026']);
 const p={name:'Осмос',description:'Описание',category:'Оборудование',price:20000,images:['/media/aaaa-bbbb.webp']};
 assert.equal(h.call('/api/admin/products','POST',p).status,403);
 assert.equal(h.call('/api/admin/products','POST',{...p,images:['https://evil.test']},394814448).status,400);
 const added=h.call('/api/admin/products','POST',p,394814448);assert.equal(added.ok,true);assert.equal(h.call('/api/products').data.products.length,2);
 assert.equal(h.call('/api/admin/products/'+added.data.product.id,'PUT',{...p,active:false},394814448).ok,true);assert.equal(h.call('/api/products').data.products.length,1);
});

