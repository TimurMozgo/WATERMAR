const money = value => new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value/100)+' грн';
export function notificationText(event, order) {
  if(event==='owner_new') {
    const lines=JSON.parse(order.items);
    let list=''; let omitted=0;
    for(const item of lines){const line=`• ${item.name} × ${item.count}\n`;if(list.length+line.length<2700)list+=line;else omitted++;}
    if(omitted)list+=`…ещё позиций: ${omitted}. Полный состав — в админ-панели.\n`;
    return `🟠 Новая заявка №${order.code}\n\nПолучатель: ${order.customer_name}\nТелефон: ${order.phone}\nTelegram ID: ${order.user_id}\n${order.username?'@'+order.username:'Username не указан'}\n\n${list}\nСумма: ${money(order.total)}\n\nСтатус: В ожидании.\nПодтвердите или отклоните заявку в админ-панели Aqua Service.`;
  }
  if(event==='received')return `🟠 Заявку №${order.code} отримано!\n\nДякуємо за замовлення в Aqua Service.\nСума: ${money(order.total)}\n\nСтатус: Очікує підтвердження.\nМи повідомимо результат тут. Деталі замовлення — у вашому профілі Aqua Service.`;
  if(event==='confirmed')return `🟢 Заявку №${order.code} прийнято!\n\nВаше замовлення підтверджено.\nСума: ${money(order.total)}\n\nМи зв’яжемося з вами, щоб узгодити оплату та доставку.\nДеталі замовлення — у вашому профілі Aqua Service.`;
  if(event==='rejected')return `🔴 Заявку №${order.code} відхилено.\n\nПричина: ${order.rejection_reason}\n\nПереглянути замовлення можна у вашому профілі Aqua Service.`;
  throw new Error('Unknown notification event');
}
export async function sendNotifications(env) {
  if(env.TELEGRAM_NOTIFICATIONS_ENABLED!=='true'||!env.BOT_TOKEN||env.LOCAL_PREVIEW)return {configured:false};
  const now=Date.now(),owner=crypto.randomUUID();
  const lock=await env.DB.prepare("INSERT INTO leases(name,owner,expires) VALUES('telegram',?,?) ON CONFLICT(name) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE leases.expires<?").bind(owner,now+180000,now).run();
  if(!lock.meta.changes)return {busy:true};
  let sent=0;
  try {
    // Preserve event order per customer/order, even when the first delivery needs a retry.
    const jobs=(await env.DB.prepare("SELECT n.* FROM notifications n WHERE n.state='pending' AND n.next_attempt<=? AND NOT EXISTS (SELECT 1 FROM notifications p WHERE p.order_id=n.order_id AND p.recipient=n.recipient AND p.id<n.id AND p.state='pending') ORDER BY n.id LIMIT 10").bind(now).all()).results;
    for(const job of jobs) {
      let retry=30000*Math.pow(2,Math.min(job.attempts,7)), terminal=false, error='Сеть Telegram недоступна';
      try {
        const payload={chat_id:job.recipient,text:notificationText(job.event,JSON.parse(job.payload))};
        if(env.APP_URL?.startsWith('https://'))payload.reply_markup={inline_keyboard:[[{text:job.event==='owner_new'?'Открыть админ-панель':'Мої замовлення',web_app:{url:env.APP_URL.replace(/\/$/,'')+(job.event==='owner_new'?'#admin':'#history')}}]]};
        const response=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
        const result=await response.json();
        if(response.ok&&result.ok){await env.DB.prepare("UPDATE notifications SET state='sent',message_id=?,last_error=NULL WHERE id=?").bind(result.result.message_id,job.id).run();sent++;continue;}
        const code=result.error_code||response.status;
        terminal=code===400||code===403;
        error=code===403?'Бот заблокирован или нет разрешения на сообщения':code===400?'Чат недоступен. Получателю нужно запустить бота':`Telegram: ${code}`;
        if(code===429)retry=Math.max(retry,Number(result.parameters?.retry_after||30)*1000);
      }catch{/* Never log a request URL: it contains the bot token. */}
      await env.DB.prepare('UPDATE notifications SET state=?,attempts=attempts+1,next_attempt=?,last_error=? WHERE id=?').bind(terminal?'failed':'pending',Date.now()+Math.min(retry,3600000),error,job.id).run();
    }
    return {sent};
  }finally{await env.DB.prepare("DELETE FROM leases WHERE name='telegram' AND owner=?").bind(owner).run();}
}
