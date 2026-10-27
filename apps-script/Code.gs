// Google Sheets is the authoritative database. Never expose these script properties.
const TABS={products:'Товары TMA',orders:'Заказы TMA',media:'Медиа TMA'};
const STATUS={pending:'В ожидании',confirmed:'Подтверждён',rejected:'Отклонён'};
function settings(){return PropertiesService.getScriptProperties();}
function sheetId(){return settings().getProperty('SHEET_ID')||'11BZXQFHtglfXM5lbS_0bvQulcS9C_UIh7tBknBSd5UY';}
function rows(tab,end){return (Sheets.Spreadsheets.Values.get(sheetId(),"'"+tab+"'!A2:"+end+'10000',{valueRenderOption:'UNFORMATTED_VALUE'}).values||[]).map((v,i)=>({v,row:i+2})).filter(r=>r.v[0]);}
function writeRow(tab,row,values){
 if(row>10000)fail(503,'Достигнут лимит записей таблицы.');
 if(values.some(v=>typeof v==='string'&&v.length>45000))fail(400,'Слишком большой заказ. Разделите его на несколько заявок.');
 Sheets.Spreadsheets.Values.update({values:[values]},sheetId(),"'"+tab+"'!A"+row,{valueInputOption:'RAW'});
}
function product(r){const v=r.v;return {id:String(v[0]),name:v[1],description:v[2],category:v[3],price:Math.round(Number(v[4])*100),images:JSON.parse(v[5]||'[]'),active:v[6]===true||v[6]===1,created_at:v[7],updated_at:v[8]};}
function order(r,admin){const v=r.v;const status=Object.keys(STATUS).find(s=>STATUS[s]===v[8])||({new:'pending',processing:'pending',completed:'confirmed',cancelled:'rejected'})[v[8]]||v[8];const o={id:String(v[0]),code:String(v[10]),created_at:v[1],items:JSON.parse(v[9]||'[]'),total:Math.round(Number(v[7])*100),status,rejection_reason:v[11]||'',reviewed_at:v[13]||''};if(admin)Object.assign(o,{user_id:String(v[2]),username:v[3]||'',customer_name:v[4],phone:String(v[5]),reviewed_by:v[12]||''});return o;}
function jobs(r){return JSON.parse(r.v[15]||'[]');}
function job(recipient,event,payload){return {recipient:String(recipient),event,text:notificationText(event,payload),state:'pending',attempts:0,next:0};}
function limited(key,max,seconds){const cache=CacheService.getScriptCache(),bucket=key+':'+Math.floor(Date.now()/(seconds*1000));const count=Number(cache.get(bucket)||0)+1;if(count>max)fail(429,'Слишком много запросов. Повторите позже.');cache.put(bucket,String(count),seconds*2);}
function page(list,offset){const n=Math.max(0,Math.min(1000000,parseInt(offset,10)||0));return {orders:list.slice(n,n+20),hasMore:list.length>n+20};}
function doGet(){return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Use the store application.'})).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 let lock;
 try{
  if(!e.postData||e.postData.contents.length>3000000)fail(413,'Слишком большой запрос.');
  let req;try{req=JSON.parse(e.postData.contents);}catch{fail(400,'Некорректный запрос.');}

  if(!req || typeof req.path!=='string' || !['GET','POST','PUT'].includes(req.method))fail(400,'Некорректный маршрут.');
  if(req.path==='/api/products'&&req.method==='GET')return output({products:rows(TABS.products,'I').map(product).filter(p=>p.active).reverse(),categories:CATEGORIES});
  if(/^\/media\/[a-f0-9-]+\.(png|jpg|webp)$/.test(req.path)&&req.method==='GET')return output(readPhoto(req.path.slice(7)));
  const user=validateTelegram(req.initData,settings().getProperty('BOT_TOKEN'));
  if(req.path==='/api/me'&&req.method==='GET')return output({user,admin:ADMIN_IDS.has(user.id)});
  if(req.path.startsWith('/api/admin/')&&!ADMIN_IDS.has(user.id))fail(403,'Нет доступа к управлению магазином.');
  // All mutations, code allocation, and delivery-state changes share one lock.
  lock=LockService.getScriptLock();if(!lock.tryLock(5000))fail(503,'Магазин занят. Повторите запрос.');
  return output(dispatch(req,user));
 }catch(error){return ContentService.createTextOutput(JSON.stringify({ok:false,status:error.status||500,error:error instanceof HttpError?error.message:'Не удалось выполнить запрос. Повторите попытку.'})).setMimeType(ContentService.MimeType.JSON);}
 finally{if(lock)lock.releaseLock();}
}
function output(data){return ContentService.createTextOutput(JSON.stringify({ok:true,data})).setMimeType(ContentService.MimeType.JSON);}
function dispatch(req,user){
 const path=req.path,method=req.method,input=req.data||{};
 if(path==='/api/orders'&&method==='GET')return page(rows(TABS.orders,'P').filter(r=>String(r.v[2])===user.id).map(r=>order(r,false)).reverse(),req.offset);
 if(path==='/api/orders'&&method==='POST'){
  const data=validateCheckout(input),all=rows(TABS.orders,'P');
  const existing=all.find(r=>String(r.v[2])===user.id&&r.v[14]===data.requestKey);if(existing)return {order:order(existing,false)};
  limited('order:'+user.id,8,300);
  const products=rows(TABS.products,'I').map(product).map(p=>({...p,images:JSON.stringify(p.images)}));
  const priced=priceOrder(data.items,products);if(priced.total!==data.quotedTotal)fail(409,'Стоимость изменилась. Обновите корзину.');
  const high=Math.max(99999,Number(settings().getProperty('LAST_ORDER_CODE')||99999),...all.map(r=>Number(r.v[10])||0));
  if(high>=999999)fail(503,'Диапазон номеров заказов исчерпан.');const code=String(high+1);
  settings().setProperty('LAST_ORDER_CODE',code); // A failed write may leave a gap, never a reused code.
  const id=Utilities.getUuid(),now=new Date().toISOString();
  const payload={code,customer_name:data.name,phone:data.phone,user_id:user.id,username:user.username,items:JSON.stringify(priced.lines),total:priced.total};
  const pending=[job(user.id,'received',payload),...Array.from(ADMIN_IDS).map(id=>job(id,'owner_new',payload))];
  const values=[id,now,user.id,user.username,data.name,data.phone,priced.lines.map(i=>i.name+' × '+i.count).join('; '),priced.total/100,STATUS.pending,payload.items,code,'','','',data.requestKey,JSON.stringify(pending)];
  const row=all.length?Math.max(...all.map(r=>r.row))+1:2;
  writeRow(TABS.orders,row,values);return {order:order({v:values},false)};
 }
 if(path==='/api/admin/orders'&&method==='GET')return page(rows(TABS.orders,'P').map(r=>order(r,true)).sort((a,b)=>(b.status==='pending')-(a.status==='pending')||b.created_at.localeCompare(a.created_at)||b.code.localeCompare(a.code)),req.offset);
 if(/^\/api\/admin\/orders\/[a-f0-9-]+\/decision$/.test(path)&&method==='POST'){
  if(!['confirmed','rejected'].includes(input.status))fail(400,'Недопустимый статус.');
  const reason=typeof input.reason==='string'?input.reason.trim():'';
  if(input.status==='rejected'&&(!reason||reason.length>500))fail(400,'Укажите причину от 1 до 500 символов.');
  const r=rows(TABS.orders,'P').find(r=>r.v[0]===path.split('/')[4]);if(!r)fail(404,'Заказ не найден.');
  const previous=order(r,true);
  if(previous.status!=='pending'){
   if(previous.status!==input.status||(input.status==='rejected'&&previous.rejection_reason!==reason))fail(409,'По заказу уже принято решение. Обновите список.');
   return {order:order(r,false)};
  }
  limited('decision:'+user.id,30,60);
  r.v[8]=STATUS[input.status];r.v[11]=input.status==='rejected'?reason:'';r.v[12]=user.id;r.v[13]=new Date().toISOString();
  r.v[15]=JSON.stringify([...jobs(r),job(previous.user_id,input.status,{code:previous.code,total:previous.total,rejection_reason:reason})]);
  writeRow(TABS.orders,r.row,r.v);return {order:order(r,false)};
 }
 if(path==='/api/admin/products'&&method==='GET')return {products:rows(TABS.products,'I').map(product).reverse()};
 if((path==='/api/admin/products'&&method==='POST')||(/^\/api\/admin\/products\/[a-f0-9-]+$/.test(path)&&method==='PUT')){
  limited('product:'+user.id,30,60);const p=validateProduct(input),media=rows(TABS.media,'D');
  for(const image of p.images)if(!media.some(r=>r.v[0]===image.slice(7)))fail(400,'Загрузите фотографию через приложение.');
  const all=rows(TABS.products,'I'),old=method==='PUT'?all.find(r=>r.v[0]===path.split('/').pop()):null;
  if(method==='PUT'&&!old)fail(404,'Товар не найден.');
  const now=new Date().toISOString(),r={row:old?.row||(all.length?Math.max(...all.map(r=>r.row))+1:2),v:[old?.v[0]||Utilities.getUuid(),p.name,p.description,p.category,p.price/100,JSON.stringify(p.images),Boolean(p.active),old?.v[7]||now,now]};
  writeRow(TABS.products,r.row,r.v);return {product:product(r)};
 }
 if(path==='/api/admin/images'&&method==='POST'){limited('upload:'+user.id,30,60);return uploadPhoto(input);}
 if(path==='/api/admin/sync')return {configured:true,pending:0,last_error:null};
 if(path==='/api/admin/notifications'&&method==='GET'){
  const all=rows(TABS.orders,'P').flatMap(jobs);return {configured:settings().getProperty('NOTIFICATIONS_ENABLED')==='true',pending:all.filter(j=>j.state==='pending').length,failed:all.filter(j=>j.state==='failed').length};
 }
 if(path==='/api/admin/notifications/retry'&&method==='POST'){
  limited('retry:'+user.id,2,60);
  for(const r of rows(TABS.orders,'P')){const list=jobs(r);if(list.some(j=>j.state!=='sent')){list.forEach(j=>{if(j.state!=='sent'){j.state='pending';j.next=0;}});r.v[15]=JSON.stringify(list);writeRow(TABS.orders,r.row,r.v);}}
  return {queued:true};
 }
 fail(404,'Не найдено.');
}
function uploadPhoto(input){
 if(typeof input.base64!=='string'||input.base64.length>2800000)fail(413,'Фото больше 2 МБ.');
 let bytes;try{bytes=Utilities.base64Decode(input.base64);}catch{fail(400,'Некорректное фото.');}
 if(bytes.length>2*1024*1024)fail(413,'Фото больше 2 МБ.');const b=bytes.map(x=>x&255);let type,ext;
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)){type='image/png';ext='png';}
 else if(b[0]===255&&b[1]===216&&b[2]===255){type='image/jpeg';ext='jpg';}
 else if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'){type='image/webp';ext='webp';}
 else fail(400,'Допустимы JPEG, PNG и WebP.');
 const key=Utilities.getUuid()+'.'+ext,folder=DriveApp.getFolderById(settings().getProperty('IMAGE_FOLDER_ID'));
 const file=folder.createFile(Utilities.newBlob(bytes,type,key));
 const all=rows(TABS.media,'D'),row=all.length?Math.max(...all.map(r=>r.row))+1:2;
 try{writeRow(TABS.media,row,[key,file.getId(),type,new Date().toISOString()]);}catch(error){file.setTrashed(true);throw error;}
 return {url:'/media/'+key};
}
function readPhoto(key){const r=rows(TABS.media,'D').find(r=>r.v[0]===key);if(!r)fail(404,'Фото не найдено.');return {base64:Utilities.base64Encode(DriveApp.getFileById(r.v[1]).getBlob().getBytes()),type:r.v[2]};}

