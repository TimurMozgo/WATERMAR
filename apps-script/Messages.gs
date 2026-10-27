const money = value => new Intl.NumberFormat('uk-UA',{maximumFractionDigits:2}).format(value/100)+' грн';
function notificationText(event, order) {
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
