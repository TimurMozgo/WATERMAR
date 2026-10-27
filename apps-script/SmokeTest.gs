// Manual technical test only. Never exposed through doPost. No Telegram messages.
function runStorageSmokeTest() {
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 let productRow, orderRow;
 try {
  const all=rows(TABS.products,'I');
  const id=Utilities.getUuid(),now=new Date().toISOString();
  productRow={row:all.length?Math.max(...all.map(r=>r.row))+1:2,v:[id,'ТЕСТ — проверка записи (не продавать)','Техническая проверка Apps Script','Оборудование',1,'[]',true,now,now]};
  writeRow(TABS.products,productRow.row,productRow.v);
  const req={path:'/api/orders',method:'POST',data:{name:'ТЕХНИЧЕСКИЙ ТЕСТ — не клиент',phone:'+380000000000',items:[{id,count:1}],quotedTotal:100,requestKey:'storage-smoke-'+Utilities.getUuid()}};
  const user={id:'0',username:'',first_name:'Технический тест'};
  const created=dispatch(req,user).order;
  orderRow=rows(TABS.orders,'P').find(r=>r.v[0]===created.id);
  if(!orderRow)throw Error('Не удалось прочитать записанный заказ');
  // Suppress jobs while holding the same lock as the delivery trigger.
  orderRow.v[15]=JSON.stringify(jobs(orderRow).map(j=>({...j,state:'skipped',error:'Техническая проверка без отправки'})));
  orderRow.v[8]=STATUS.rejected;orderRow.v[11]='Техническая проверка записи. Не настоящий заказ.';
  orderRow.v[12]='SYSTEM_TEST';orderRow.v[13]=new Date().toISOString();
  writeRow(TABS.orders,orderRow.row,orderRow.v);
  const retry=dispatch(req,user).order;
  if(retry.id!==created.id)throw Error('Ошибка защиты от повторного заказа');
  console.log('Заказ №'+created.code+' записан и прочитан; повторный запрос не создал дубликат. Строка '+orderRow.row+'. Сообщения не отправлялись.');
 } finally {
  if(productRow){productRow.v[6]=false;writeRow(TABS.products,productRow.row,productRow.v);}
  lock.releaseLock();
 }
}
