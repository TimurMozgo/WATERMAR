// Run manually to connect the published storefront. No messages are sent.
function initializeServer() {
 const url='https://timurmozgo.github.io/WATERMAR/';
 const token=settings().getProperty('BOT_TOKEN');
 function telegramCall(method,data){
  let result;
  try {result=JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'post',contentType:'application/json',payload:JSON.stringify(data),muteHttpExceptions:true}).getContentText());}
  catch(_){throw Error('Не удалось связаться с Telegram');}
  if(!result.ok)throw Error('Telegram отказал в настройке: '+result.error_code);
  return result.result;
 }
 telegramCall('setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть магазин',web_app:{url:url}}});
 const menu=telegramCall('getChatMenuButton',{});
 if(menu.type!=='web_app'||menu.web_app.url!==url)throw Error('Проверьте кнопку меню');
 settings().setProperty('APP_URL',url);
 console.log('Кнопка бота и ссылки в уведомлениях подключены: '+url);
}
