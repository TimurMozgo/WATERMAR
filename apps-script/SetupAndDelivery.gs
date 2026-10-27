function deliverNotifications(){
 if(settings().getProperty('NOTIFICATIONS_ENABLED')!=='true')return;
 const token=settings().getProperty('BOT_TOKEN');if(!token)return;
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 const began=Date.now();let count=0;
 try{
  for(const r of rows(TABS.orders,'P')){
   const list=jobs(r);
   for(let i=0;i<list.length;i++){
    const j=list[i];if(j.state!=='pending'||j.next>Date.now())continue;
    if(list.slice(0,i).some(p=>p.recipient===j.recipient&&p.state==='pending'))continue;
    if(count>=4||Date.now()-began>15000)return;
    count++;
    try{
     const payload={chat_id:j.recipient,text:j.text};const url=settings().getProperty('APP_URL');
     if(/^https:\/\//.test(url||''))payload.reply_markup={inline_keyboard:[[{text:j.event==='owner_new'?'Открыть админ-панель':'Мої замовлення',web_app:{url:url.replace(/\/$/,'')+(j.event==='owner_new'?'#admin':'#history')}}]]};
     const response=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
     const result=JSON.parse(response.getContentText());
     if(result.ok){j.state='sent';j.message_id=result.result.message_id;j.error='';}
     else{j.attempts++;j.state=[400,403].includes(result.error_code)?'failed':'pending';j.error=result.error_code===403?'Бот заблокирован или сообщения не разрешены':'Telegram: '+result.error_code;j.next=Date.now()+Math.max(Math.min(3600000,30000*Math.pow(2,Math.min(j.attempts,7))),Number(result.parameters?.retry_after||0)*1000);}
    }catch{j.attempts++;j.next=Date.now()+Math.min(3600000,60000*Math.pow(2,Math.min(j.attempts,6)));j.error='Ошибка связи с Telegram';}
    r.v[15]=JSON.stringify(list);writeRow(TABS.orders,r.row,r.v);
   }
  }
 }finally{lock.releaseLock();}
}
// Run manually once from the editor after setting BOT_TOKEN and GATEWAY_SECRET.
// No notifications are enabled by this setup; enable only after deployment verification.
function setupStore(){
 const props=settings();if(!props.getProperty('BOT_TOKEN'))throw Error('Добавьте BOT_TOKEN в Script properties.');
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  const book=SpreadsheetApp.openById(sheetId());
  const schemas={
   'Товары TMA':['ID','Название','Описание','Категория','Цена, ₴','Фотографии JSON','Активен','Создан','Обновлён'],
   'Заказы TMA':['ID','Дата','Telegram ID','Username','Клиент','Телефон','Товары','Сумма, ₴','Статус','Состав JSON','Код заказа','Причина отклонения','Решение принял, Telegram ID','Дата решения','Ключ запроса','Уведомления JSON'],
   'Медиа TMA':['Ключ','Drive file ID','Тип файла','Создан']
  };
  // Check all existing headers before changing any sheet.
  for(const name of Object.keys(schemas)){
   const sheet=book.getSheetByName(name);if(!sheet||!sheet.getLastRow())continue;
   const current=sheet.getRange(1,1,1,Math.min(sheet.getLastColumn(),schemas[name].length)).getValues()[0];
   current.forEach((v,i)=>{if(v&&v!==schemas[name][i])throw Error('Проверьте заголовок '+name+', колонка '+(i+1));});
  }
  for(const name of Object.keys(schemas)){
   const headers=schemas[name],sheet=book.getSheetByName(name)||book.insertSheet(name);
   if(sheet.getMaxColumns()<headers.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),headers.length-sheet.getMaxColumns());
   if(sheet.getMaxRows()<10000)sheet.insertRowsAfter(sheet.getMaxRows(),10000-sheet.getMaxRows());
   sheet.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#142130').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
   sheet.setFrozenRows(1);sheet.setRowHeight(1,42);
  }
  book.getSheetByName(TABS.orders).hideColumns(15,2);
  if(!props.getProperty('IMAGE_FOLDER_ID'))props.setProperty('IMAGE_FOLDER_ID',DriveApp.createFolder('Aqua Service — фотографии товаров').getId());
  if(!props.getProperty('NOTIFICATIONS_ENABLED'))props.setProperty('NOTIFICATIONS_ENABLED','false');
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='deliverNotifications'))ScriptApp.newTrigger('deliverNotifications').timeBased().everyMinutes(1).create();
 }finally{lock.releaseLock();}
}

