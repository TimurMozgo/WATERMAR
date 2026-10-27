import { storeApi, imageUrl } from './transport.js';
const icons = {
  catalog: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', back: '<path d="M20 12H4m6-6-6 6 6 6"/>', chevron: '<path d="m9 5 7 7-7 7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5l8-3Z"/><path d="m8 11 3 3 5-5"/>',
  drop: '<path d="M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z"/><path d="M8 15c0 2 1 4 4 4"/>',
  truck: '<path d="M3 5h12v12H3V5Zm12 5h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-11a9 9 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.drop}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value / 100);
const price = value => `${money(value)} <small>₴</small>`;
const date = value => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
const safeImage = imageUrl;
const categories = ['Оборудование', 'Расходные материалы', 'Услуги'];
const telegram = window.Telegram?.WebApp;
try { telegram?.ready(); telegram?.expand(); telegram?.setHeaderColor?.('#071827'); telegram?.setBackgroundColor?.('#071827'); } catch { /* Older Telegram clients still work. */ }
function readStore(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveStore(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ } }
const saved = readStore('watermar.cart.v2', []);
const state = { products: [], cart: Array.isArray(saved) ? saved.filter(i => typeof i?.id === 'string' && Number.isInteger(i.count) && i.count > 0 && i.count <= 99).slice(0,50) : [], user: null, admin: false, preview: false, category: 'Все', query: '', tab: 'catalog', orders: [], hasMore: false, loading: true, error: '', authError: '', adminProducts: [], adminSection: 'products', editor: null, pending: false };
let toastTimer, modalFocus, closeTimer, routeVersion = 0;
const reads = new Map();
let ordersLoaded = false, ordersUpdated = 0, adminUpdated = 0;
async function api(path, options = {}) {
  if (options.method && options.method !== 'GET') {
    ordersUpdated = adminUpdated = 0;
    return storeApi(path, options, telegram?.initData || '');
  }
  if (!reads.has(path)) reads.set(path,storeApi(path, options, telegram?.initData || '').finally(()=>reads.delete(path)));
  return reads.get(path);
}
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2800); }
function haptic() { try { telegram?.HapticFeedback?.impactOccurred('light'); } catch {} }
function persistCart() { saveStore('watermar.cart.v2', state.cart); updateBadge(); }
function updateBadge() { const count = state.cart.reduce((a,b) => a+b.count,0); $('#cart-badge').textContent = count > 99 ? '99+' : count; $('#cart-badge').hidden = !count; }
function add(id) {
  const p = state.products.find(p => p.id === id); if (!p) return false;
  const found = state.cart.find(i => i.id === id);
  if (found && found.count >= 99) { toast('Максимум 99 единиц одного товара.'); return false; }
  if (found) found.count++; else state.cart.push({ id, count:1 });
  persistCart(); haptic(); return true;
}
function empty(title, description, glyph = 'bag', action = '<a class="primary" href="#catalog">Перейти в каталог</a>') {
  return `<div class="empty"><div class="empty-icon">${icon(glyph)}</div><h2>${esc(title)}</h2><p>${esc(description)}</p>${action}</div>`;
}
const loading = () => '<div class="loading-state"><div class="spinner"></div><p>Один момент…</p></div>';
function updateNav() {
  document.querySelector('[data-tab=admin]').hidden=!state.admin;
  document.querySelector('.dock').classList.toggle('admin-nav',state.admin);
  const base = state.tab === 'history' ? 'profile' : state.tab;
  document.querySelectorAll('[data-tab]').forEach(a => { if (a.dataset.tab === base) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  $('.dock-highlight').style.transform = `translateX(${['catalog','cart','profile','admin'].indexOf(base) * 100}%)`;
  try { if (state.tab !== 'catalog' || $('#sheet').open) telegram?.BackButton?.show(); else telegram?.BackButton?.hide(); } catch {}
}
const careNote = () => `<p class="quiet-footer">AQUA SERVICE · ЧИСТАЯ ВОДА КАЖДЫЙ ДЕНЬ</p>`;
function catalog() {
  return `<section class="page"><div class="hero"><div class="hero-copy"><span class="eyebrow">СИСТЕМЫ ОБРАТНОГО ОСМОСА</span><h1>Больше, чем<br>просто<br><em>вода.</em></h1><p>Системы обратного осмоса для вашего дома. Чистота в каждой детали.</p><a href="#collection" class="hero-link" data-action="collection">Выбрать систему ${icon('arrow')}</a></div><div class="hero-art"><img class="hero-osmosis" src="./img/hero-studio.webp" alt="Система обратного осмоса Waterdrop X16"><small>REVERSE OSMOSIS / PURE WATER</small></div></div><div id="collection" class="section-heading"><div><span class="eyebrow">ВЫБРАНО ДЛЯ ВАС</span><h2 style="margin-top:8px">Каталог решений</h2></div><span id="collection-count" class="collection-count"></span></div><div class="catalog-tools"><div class="chips" aria-label="Категории">${['Все',...categories].map(c => `<button class="chip ${state.category === c ? 'active' : ''}" aria-pressed="${state.category === c}" data-action="category" data-category="${esc(c)}">${esc(c)}</button>`).join('')}</div><label class="search">${icon('search')}<input id="search" type="search" aria-label="Поиск товаров" placeholder="Найти нужное" value="${esc(state.query)}" autocomplete="off"></label></div><div id="products" class="product-grid"></div>${careNote()}</section>`;
}
function renderProducts() {
  const target = $('#products'); if (!target) return;
  const query = state.query.toLocaleLowerCase('ru');
  const found = state.products.filter(p => (state.category === 'Все' || p.category === state.category) && `${p.name} ${p.description}`.toLocaleLowerCase('ru').includes(query));
  $('#collection-count').textContent = `${found.length} в коллекции`;
  if (state.loading) { target.innerHTML = loading(); return; }
  if (state.error) { target.innerHTML = empty('Не удалось загрузить каталог', state.error, 'drop', '<button class="primary" data-action="retry">Попробовать снова</button>'); return; }
  target.innerHTML = found.map(p => `<article class="product-card"><div class="product-visual"><button class="product-open" data-action="details" data-id="${esc(p.id)}" aria-label="Подробнее: ${esc(p.name)}"><img src="${esc(safeImage(p.images[0]))}" alt="${esc(p.name)}" loading="lazy" width="300" height="300"></button><span class="product-tag">${esc(p.category)}</span><button class="quick-add" data-action="add" data-id="${esc(p.id)}" aria-label="Добавить ${esc(p.name)} в корзину">${icon('plus')}</button></div><div class="product-info"><span class="eyebrow">WATERMAR COLLECTION</span><button class="product-name" data-action="details" data-id="${esc(p.id)}">${esc(p.name)}</button><p class="product-description">${esc(p.description.split('\n')[0])}</p><div class="product-bottom"><span class="price">${price(p.price)}</span><button class="details-link" data-action="details" data-id="${esc(p.id)}" aria-label="Подробнее: ${esc(p.name)}">Подробнее ${icon('arrow')}</button></div></div></article>`).join('') || empty(state.products.length ? 'Ничего не найдено' : 'Коллекция скоро появится', state.products.length ? 'Попробуйте другое название или выберите все категории.' : 'Мы готовим для вас оборудование и услуги. Загляните чуть позже.', 'search', state.products.length ? '<button class="secondary" data-action="reset-search">Сбросить поиск</button>' : '');
}
function cartLines() { return state.cart.map(i => ({ ...i, product: state.products.find(p => p.id === i.id) })); }
function cart() {
  const lines = cartLines(); const total = lines.reduce((sum,i) => sum + (i.product?.price || 0) * i.count,0);
  return `<section class="page"><header class="page-header"><span class="eyebrow">ВАШ ВЫБОР</span><h1 style="margin-top:10px">Корзина</h1><p>Хорошие перемены начинаются с малого.</p></header>${!lines.length ? empty('Здесь начинается забота', 'Добавьте в корзину то, что сделает вашу воду лучше.') : `<div class="cart-layout"><div class="panel">${lines.map(i => `<article class="cart-item"><img class="cart-image" src="${esc(safeImage(i.product?.images[0]))}" alt="${esc(i.product?.name || 'Товар недоступен')}"><div class="cart-info"><h3>${esc(i.product?.name || 'Товар больше недоступен')}</h3><p class="muted">${esc(i.product?.category || 'Удалите товар, чтобы продолжить')}</p><div class="cart-controls"><div class="stepper"><button data-action="quantity" data-id="${esc(i.id)}" data-delta="-1" aria-label="Уменьшить количество">${icon('minus')}</button><span>${i.count}</span><button data-action="quantity" data-id="${esc(i.id)}" data-delta="1" aria-label="Увеличить количество" ${i.count >= 99 ? 'disabled' : ''}>${icon('plus')}</button></div><span class="price">${price((i.product?.price || 0) * i.count)}</span></div></div><button class="remove" data-action="remove" data-id="${esc(i.id)}" aria-label="Удалить товар">${icon('close')}</button></article>`).join('')}</div><aside class="panel"><h3>Всё для вашей воды</h3><div class="summary-row"><span>Товаров</span><span>${lines.reduce((s,i) => s+i.count,0)}</span></div><div class="summary-row"><span>Доставка и установка</span><span>Согласуем</span></div><div class="summary-row summary-total"><span>Итого</span><span>${money(total)} ₴</span></div><button class="primary wide" data-action="checkout" ${lines.some(i=>!i.product) || state.loading ? 'disabled' : ''}>Оформить заказ ${icon('arrow')}</button><p class="fine-print">Без оплаты сейчас. Специалист свяжется с вами<br>и согласует детали заказа.</p></aside></div>`}${careNote()}</section>`;
}
function orderStatus(order) { return '<span class="status status-'+esc(order.status)+'">'+({pending:'В ожидании',confirmed:'Подтверждён',rejected:'Отклонён'}[order.status]||esc(order.status))+'</span>'; }
function rejectionNote(order) { return order.status==='rejected' ? '<p class="rejection-reason"><strong>Причина:</strong> '+esc(order.rejection_reason||'Причина не указана')+'</p>' : ''; }
function itemHistory(item, order, showStatus=true) { return `<div class="history-row"><img src="${esc(safeImage(item.image))}" alt="${esc(item.name)}" loading="lazy"><div><h3>${esc(item.name)}</h3><p>${date(order.created_at)} · ${item.count} шт. · № ${esc(order.code)}</p>${showStatus?orderStatus(order)+rejectionNote(order):''}</div><span class="price">${price(item.price * item.count)}</span></div>`; }
function loginMessage() { return empty('Ваш WATERMAR — в Telegram', state.authError || 'Откройте приложение через нашего бота, чтобы оформить заказ и видеть свою историю.', 'user', '<a class="primary" href="https://t.me/aquaservicer_bot" target="_blank" rel="noopener">Открыть Telegram '+icon('arrow')+'</a>'); }
function profile() {
  if (!state.user) return `<section class="page"><header class="page-header"><h1>Мой профиль</h1></header>${loginMessage()}</section>`;
  const name = [state.user.first_name,state.user.last_name].filter(Boolean).join(' ');
  const recent = state.orders.flatMap(order => order.items.map(item => ({item,order}))).slice(0,3);
  return `<section class="page"><header class="page-header"><span class="eyebrow">ЛИЧНОЕ ПРОСТРАНСТВО</span><h1 style="margin-top:10px">Мой профиль</h1></header><div class="profile-card"><div class="avatar">${esc(name.slice(0,1).toUpperCase() || 'W')}</div><div><h2>${esc(name || 'Гость')}</h2><p>${state.user.username ? '@'+esc(state.user.username) : 'Профиль Telegram'}</p></div><span class="verified" aria-label="Подтверждено Telegram">${icon('shield')}</span></div><div class="section-heading"><div><h2>История заказов</h2><p>Ваши последние покупки</p></div>${state.orders.length ? '<a href="#history" class="text-button">Смотреть все →</a>' : ''}</div><div class="history-list">${recent.length ? recent.map(({item,order})=>itemHistory(item,order)).join('') : empty('Всё ещё впереди', 'Здесь появятся ваши покупки. Найдите своё первое решение в каталоге.', 'clock')}</div>${careNote()}</section>`;
}
function history() {
  return `<section class="page"><a class="back-link" href="#profile">${icon('back')}Мой профиль</a><header class="page-header" style="padding-top:0"><h1>Все заказы</h1><p>Каждая покупка — в одном месте.</p></header>${state.orders.map(o => `<article class="order-group"><div class="order-meta"><span>Заказ № ${esc(o.code)}<br><span class="muted">${date(o.created_at)}</span></span>${orderStatus(o)}</div>${rejectionNote(o)}${o.items.map(i=>itemHistory(i,o,false)).join('')}<div class="order-total"><span>Сумма заказа</span><strong>${money(o.total)} ₴</strong></div></article>`).join('') || empty('Пока нет заказов','Ваши покупки появятся здесь.','clock')}${state.hasMore ? '<button class="secondary wide" data-action="load-orders">Показать ещё</button>' : ''}</section>`;
}
async function renderAdmin(version, returnOnly = false) {
  const [result,sync,orders,notifications] = await Promise.all([api('/admin/products'),Promise.resolve({configured:true,pending:0}),api('/admin/orders'),api('/admin/notifications')]);
  if (version !== routeVersion || state.tab !== 'admin') return;
  state.adminProducts = result.products; state.adminOrders=orders.orders; state.adminHasMore=orders.hasMore;
  state.adminPanels = {orders: `<header class="page-header"><h2>Заказы</h2><p>Сначала заявки, ожидающие вашего решения.</p><button class="text-button" data-action="refresh-admin">Обновить заявки</button></header><div class="sync-status">${!notifications.configured ? 'Telegram: отправка сообщений пока не подключена' : `Telegram: в очереди ${notifications.pending}, не доставлено ${notifications.failed}`}${notifications.configured && (notifications.failed || notifications.pending) ? '<button data-action="retry-notifications">Повторить отправку</button>' : ''}</div><div id="admin-orders">${adminOrdersHTML()}</div>`, products: `<header class="page-header admin-top"><div><h2>Товары</h2></div><button class="primary" data-action="new-product">${icon('plus')}Добавить</button></header><div class="sync-status"><span>${!sync.configured ? 'Google Sheets: ожидает подключения' : sync.pending ? `Ожидают записи в таблицу: ${sync.pending}${sync.last_error ? '. Повторим автоматически.' : ''}` : 'Все изменения записаны в Google Sheets'}</span>${sync.configured && sync.pending ? '<button data-action="sync">Повторить</button>' : ''}</div><div class="stack">${result.products.map(p=>`<article class="admin-item"><img src="${esc(safeImage(p.images[0]))}" alt=""><div><h3>${esc(p.name)}</h3><p>${esc(p.category)} · ${money(p.price)} ₴ · ${p.active ? 'В каталоге' : 'Скрыт'}</p></div><button data-action="edit-product" data-id="${esc(p.id)}">Изменить</button></article>`).join('') || empty('Добавьте первый товар','Загрузите фотографии, описание и цену. Товар появится в каталоге после сохранения.','image','<button class="primary" data-action="new-product">Добавить товар</button>')}</div>`};
  adminUpdated = Date.now();
  const html = `<section class="page"><header class="page-header"><span class="eyebrow">МАГАЗИН AQUA SERVICE</span><h1>Управление</h1></header><div class="admin-sections" aria-label="Разделы управления">${[['products','Добавление товаров','plus'],['orders','Заказы','bag']].map(([id,label,glyph])=>`<button class="admin-section ${state.adminSection===id?'active':''}" aria-pressed="${state.adminSection===id}" aria-controls="admin-panel" data-action="admin-section" data-section="${id}">${icon(glyph)}${label}</button>`).join('')}</div><div id="admin-panel">${state.adminPanels[state.adminSection]}</div></section>`;
  state.adminHTML = html;
  if (returnOnly) return html;
  $('#app').innerHTML = html;
}
// The owner explicitly selected visible, slow motion for this storefront.
const motion = () => document.documentElement.dataset.motion === 'smooth' || !matchMedia('(prefers-reduced-motion: reduce)').matches;
let scrollFrame;
function stopSmoothScroll() { cancelAnimationFrame(scrollFrame); }
for (const event of ['wheel','touchstart','pointerdown','keydown']) window.addEventListener(event,stopSmoothScroll,{passive:true});
function scrollToCollection() {
  stopSmoothScroll();
  const start = window.scrollY;
  const target = Math.max(0,Math.min(start + $('#collection').getBoundingClientRect().top - 24,document.documentElement.scrollHeight - innerHeight));
  const began = performance.now();
  function frame(now) {
    const t = Math.min(1,(now-began)/1000);
    const eased = t < .5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
    window.scrollTo({top:start+(target-start)*eased,behavior:'instant'});
    if(t<1)scrollFrame=requestAnimationFrame(frame);
  }
  scrollFrame=requestAnimationFrame(frame);
}
const swaps = new WeakMap();
async function smoothSwap(target, commit, valid = () => true) {
  const previous = swaps.get(target); previous?.animation?.cancel();
  const run = {}; swaps.set(target,run);
  const current = () => swaps.get(target)===run && target.isConnected && valid();
  if (!motion()) { if(current()) commit(); return; }
  run.animation=target.animate([{opacity:getComputedStyle(target).opacity,transform:'translateY(0)'},{opacity:0,transform:'translateY(-12px)'}],{duration:240,easing:'ease-in-out',fill:'forwards'});
  await run.animation.finished.catch(()=>{});
  if(!current())return;
  commit(); run.animation.cancel();
  run.animation=target.animate([{opacity:0,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],{duration:700,easing:'cubic-bezier(.22,.65,.25,1)',fill:'both'});
  await run.animation.finished.catch(()=>{});
  if(current()){run.animation.cancel();swaps.delete(target);}
}
async function route() {
  stopSmoothScroll();
  const version = ++routeVersion;
  const tab = location.hash.slice(1) || 'catalog';
  state.tab = ['catalog','cart','profile','history','admin'].includes(tab) ? tab : 'catalog';
  const current = () => version === routeVersion;
  if ($('#sheet').open) closeSheet();
  updateNav();
  let content, refresh;
  if (state.tab === 'catalog') content = catalog();
  if (state.tab === 'cart') content = cart();
  if (state.tab === 'profile' || state.tab === 'history') {
    content = state.tab === 'history' && state.user ? history() : profile();
    if (state.user && !ordersLoaded) content = '<section class="page"><header class="page-header"><h1>'+ (state.tab==='history'?'Все заказы':'Мой профиль') +'</h1></header>'+loading()+'</section>';
    if (state.user && Date.now()-ordersUpdated>15000) refresh = async () => {
      const r = await api('/orders');
      if (!current()) return;
      state.orders=r.orders;state.hasMore=r.hasMore;ordersLoaded=true;ordersUpdated=Date.now();
      $('#app').innerHTML=state.tab==='history'?history():profile();
    };
  }
  if (state.tab === 'admin') {
    if (!state.admin) content=empty('Раздел для администратора','Войдите через Telegram с аккаунтом владельца магазина.','shield','<a class="primary" href="#profile">Мой профиль</a>');
    else {
      content=state.adminHTML || '<section class="page"><header class="page-header"><h1>Управление</h1></header>'+loading()+'</section>';
      if(!state.adminHTML || Date.now()-adminUpdated>15000) refresh=()=>renderAdmin(version);
    }
  }
  const transition=smoothSwap($('#app'),()=>{
    $('#app').innerHTML=content;$('#app').removeAttribute('aria-busy');
    if(state.tab==='catalog')renderProducts();window.scrollTo({top:0,behavior:'instant'});
  },current);
  // Show the destination before waiting for Google.
  refresh ? Promise.resolve().then(async()=>{
    // Wait only for the outgoing animation before allowing a refresh to render.
    await transition;
    if(current()) await refresh();
  }).catch(e=>{
    if(!current())return;
    if((state.tab==='admin'&&state.adminHTML)||(state.tab!=='admin'&&ordersLoaded))toast(e.message);
    else $('#app').innerHTML=empty('Не удалось загрузить данные',e.message,'clock','<button class="primary" data-action="reload-page">Повторить</button>');
  }) : null;
  await transition;
}
async function load() {
  state.loading = true; state.error = ''; renderProducts();
  try { const result = await api('/products'); state.products = result.products; }
  catch (e) { state.error = e.message; }
  state.loading = false;
  try { const me = await api('/me'); state.user = me.user; state.admin = me.admin; state.preview = Boolean(me.preview); $('#preview-banner').hidden = !state.preview; }
  catch (e) { state.authError = telegram?.initData ? e.message : ''; }
  await route();
}
function openSheet(content) {
  clearTimeout(closeTimer);
  const dialog=$('#sheet');dialog.classList.remove('closing');
  if(dialog.open){
    return smoothSwap($('#sheet-body'),()=>{
      const oldHeight=dialog.getBoundingClientRect().height;
      dialog.style.height=oldHeight+'px';
      $('#sheet-body').innerHTML=content;
      const style=getComputedStyle(dialog);
      const newHeight=Math.min($('#sheet-body').offsetHeight+parseFloat(style.paddingBottom)+2,window.innerHeight*.9);
      dialog.scrollTo({top:0,behavior:'smooth'});
      if(motion())dialog.animate([{height:oldHeight+'px'},{height:newHeight+'px'}],{duration:700,easing:'cubic-bezier(.22,.65,.25,1)'}).finished.catch(()=>{}).finally(()=>{dialog.style.height='';});
      else dialog.style.height='';
    });
  }
  modalFocus=document.activeElement;
  $('#sheet-body').innerHTML=content;
  dialog.showModal();document.body.style.overflow='hidden';dialog.scrollTop=0;updateNav();
}
function closeSheet(afterClose) {
  if(state.pending)return;
  const dialog=$('#sheet');if(!dialog.open){if(typeof afterClose==='function')afterClose();return;}
  clearTimeout(closeTimer);dialog.classList.add('closing');
  closeTimer=setTimeout(()=>{dialog.close();dialog.classList.remove('closing');document.body.style.overflow='';state.editor=null;modalFocus?.isConnected&&modalFocus.focus({preventScroll:true});updateNav();if(typeof afterClose==='function')afterClose();},motion()?520:0);
}
function details(id) {
  const p = state.products.find(p => p.id === id); if (!p) return;
  openSheet(`<div class="gallery-track" aria-label="Фотографии товара">${p.images.map((src,i)=>`<img src="${esc(safeImage(src))}" alt="${esc(p.name)} — фото ${i+1}" loading="${i ? 'lazy' : 'eager'}">`).join('')}</div>${p.images.length>1 ? `<div class="gallery-dots">${p.images.map((_,i)=>`<button class="${i===0?'active':''}" data-action="photo" data-index="${i}" aria-label="Фото ${i+1}"></button>`).join('')}</div><p class="gallery-note">Листайте, чтобы рассмотреть ближе</p>` : ''}<div class="modal-content"><span class="eyebrow">${esc(p.category)}</span><h2 id="sheet-title">${esc(p.name)}</h2><p class="product-detail-text">${esc(p.description)}</p><div class="detail-footer"><span class="price">${price(p.price)}</span><button class="primary" data-action="add" data-id="${esc(p.id)}">${icon('plus')}В корзину</button></div></div>`);
  const track = $('.gallery-track');
  track.addEventListener('scroll', () => { const current = Math.round(track.scrollLeft / track.clientWidth); document.querySelectorAll('.gallery-dots button').forEach((b,i)=>b.classList.toggle('active',i===current)); }, {passive:true});
}
function checkout() {
  if (!state.user) { openSheet(`<div class="modal-content"><h2 id="sheet-title">Оформление заказа</h2>${loginMessage()}</div>`); return; }
  const lines = cartLines(); if (!lines.length || lines.some(i=>!i.product)) return;
  const total = lines.reduce((s,i)=>s+i.count*i.product.price,0);
  openSheet(`<div class="modal-content"><span class="eyebrow">ПОЧТИ ГОТОВО</span><h2 id="sheet-title" class="form-title">Как с вами связаться?</h2><form id="checkout-form"><label>Ваше имя<input name="name" autocomplete="name" maxlength="100" minlength="2" required value="${esc(state.user.first_name)}" placeholder="Имя"></label><label>Номер телефона<span class="phone-field"><span class="phone-prefix">+380</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" minlength="9" maxlength="9" pattern="[0-9]{9}" required placeholder="50 123 45 67" aria-describedby="phone-hint"></span></label><small id="phone-hint" class="phone-hint">Введите 9 цифр после +380</small><div class="summary-row summary-total"><span>Итого</span><span>${money(total)} ₴</span></div><p class="fine-print" style="text-align:left">Нажимая «Отправить заявку», вы передаёте магазину имя, телефон и состав заказа для связи с вами. Оплата и доставка согласуются со специалистом.</p><button class="text-button notify-access" type="button" data-action="allow-notifications">Получать статус заказа в Telegram</button><p class="form-error" role="alert"></p><button class="primary wide" type="submit">Отправить заявку ${icon('arrow')}</button></form></div>`);
}
async function submitCheckout(form) {
  if (state.pending) return;
  const values = Object.fromEntries(new FormData(form));
  if (!/^\d{9}$/.test(values.phone)) { form.querySelector('.form-error').textContent='Введите ровно 9 цифр после +380.'; return; }
  values.phone = '+380' + values.phone;
  const items = state.cart.map(({id,count})=>({id,count}));
  const fingerprint = JSON.stringify({ user: state.user.id, ...values, items });
  let pending = readStore('watermar.pending.v2',null);
  if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, requestKey: crypto.randomUUID() };
  saveStore('watermar.pending.v2',pending);
  state.pending = true; const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Сохраняем заказ…'; form.querySelector('.form-error').textContent='';
  try {
    const quotedTotal = cartLines().reduce((sum,item)=>sum+(item.product?.price||0)*item.count,0);
    const {order} = await api('/orders',{method:'POST',data:{ ...values, items, quotedTotal, requestKey: pending.requestKey }});
    state.orders=[order,...state.orders.filter(o=>o.id!==order.id)];ordersLoaded=true;ordersUpdated=0;state.cart=[];persistCart();saveStore('watermar.pending.v2',null);state.pending=false;
    if(state.tab==='cart') $('#app').innerHTML=cart();
    openSheet(`<div class="modal-content success-content"><div class="success-symbol">${icon('check')}</div><span class="eyebrow">СПАСИБО ЗА ДОВЕРИЕ</span><h2 id="sheet-title">Заявка получена</h2>${orderStatus(order)}<p>№ ${esc(order.code)}<br>Ожидает подтверждения администратора.<br>Заказ уже доступен в вашем профиле.</p><button class="primary wide" data-action="view-history">Мои заказы ${icon('arrow')}</button></div>`);haptic();
  } catch(e) { form.querySelector('.form-error').textContent=e.message; }
  finally { state.pending=false;button.disabled=false;button.textContent='Отправить заявку'; }
}
function adminOrdersHTML() {
  const cards=state.adminOrders.map(o=>`<article class="order-group"><div class="order-meta"><strong>Заявка № ${esc(o.code)}</strong>${orderStatus(o)}</div><p class="muted">${date(o.created_at)}</p><div class="order-customer"><strong>${esc(o.customer_name)}</strong><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a><span>Telegram ID: ${esc(o.user_id)}${o.username?' · @'+esc(o.username):''}</span></div><ul class="order-lines">${o.items.map(i=>`<li>${esc(i.name)} <span>× ${i.count}</span></li>`).join('')}</ul><div class="order-total"><span>Сумма</span><strong>${money(o.total)} ₴</strong></div>${rejectionNote(o)}${o.status==='pending'?`<div class="decision-actions"><button class="primary approve" data-action="review-order" data-id="${esc(o.id)}" data-status="confirmed">${icon('check')}Подтвердить</button><button class="secondary reject" data-action="review-order" data-id="${esc(o.id)}" data-status="rejected">Отклонить</button></div>`:`<p class="muted decision-audit">Решение: ${o.reviewed_at?date(o.reviewed_at):'ранее'}${o.reviewed_by?' · ID '+esc(o.reviewed_by):''}</p>`}</article>`).join('') || empty('Заявок пока нет','Новые заказы появятся здесь.','clock');
  return cards+(state.adminHasMore?'<button class="secondary wide" data-action="more-admin-orders">Показать ещё</button>':'');
}
function reviewOrder(id,status) {
  const order=state.adminOrders.find(o=>o.id===id);if(!order)return;
  const reject=status==='rejected';
  openSheet(`<div class="modal-content"><span class="eyebrow">ЗАЯВКА № ${esc(order.code)}</span><h2 id="sheet-title">${reject?'Отклонить заявку':'Подтвердить заявку'}</h2><p>${esc(order.customer_name)} · ${money(order.total)} ₴</p><form id="decision-form" data-id="${esc(id)}" data-status="${status}">${reject?'<label>Причина для клиента<textarea name="reason" required maxlength="500" placeholder="Укажите причину отклонения"></textarea></label><p class="fine-print">Можно написать на любом языке. Клиент увидит этот текст без изменений.</p>':'<p class="fine-print">Клиент получит подтверждение от бота. Изменить решение повторным нажатием нельзя.</p>'}<p class="form-error" role="alert"></p><button type="submit" class="primary wide ${reject?'reject':'approve'}">${reject?'Отклонить и уведомить':'Подтвердить и уведомить'}</button></form></div>`);
}
async function submitDecision(form) {
  if(state.pending)return;
  const button=form.querySelector('button[type=submit]');state.pending=true;button.disabled=true;
  try {
    await api('/admin/orders/'+form.dataset.id+'/decision',{method:'POST',data:{status:form.dataset.status,reason:new FormData(form).get('reason')||''}});
    state.pending=false;closeSheet();await renderAdmin(routeVersion);toast('Решение сохранено');
  }catch(e){form.querySelector('.form-error').textContent=e.message;}
  finally{state.pending=false;button.disabled=false;}
}
function editor(id) {
  const p = state.adminProducts.find(p=>p.id===id);
  state.editor={id:p?.id,images:[...(p?.images || [])]};
  openSheet(`<div class="modal-content"><span class="eyebrow">КАТАЛОГ WATERMAR</span><h2 id="sheet-title" class="form-title">${p?'Редактировать товар':'Новый товар'}</h2><form id="product-form"><label class="upload-zone" for="photos">${icon('image')}Добавить фотографии<small>JPEG, PNG или WebP · до 8 фото · до 5 МБ</small></label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><div id="photo-list" class="photo-list"></div><p id="upload-status" class="muted" role="status" style="font-size:11px"></p><label>Название<input name="name" value="${esc(p?.name || '')}" required maxlength="150" placeholder="Например, Watermar RO-5"></label><label>Описание<textarea name="description" required maxlength="5000" placeholder="Расскажите о товаре, его особенностях и комплектации">${esc(p?.description || '')}</textarea></label><div class="field-row"><label>Категория<select name="category">${categories.map(c=>`<option ${c===p?.category?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Цена, ₴<input name="price" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" required value="${p ? p.price/100 : ''}" placeholder="0.00"></label></div><label class="check-label"><input name="active" type="checkbox" ${p?.active!==false?'checked':''}>Показывать в каталоге</label><p class="form-error" role="alert"></p><button class="primary wide" type="submit">${p?'Сохранить изменения':'Добавить товар'} ${icon('check')}</button></form></div>`);
  renderPhotos();
}
function renderPhotos() { const target=$('#photo-list');if(!target||!state.editor)return;target.innerHTML=state.editor.images.map((src,i)=>`<div class="photo-thumb"><img src="${esc(safeImage(src))}" alt="Фото ${i+1}"><button type="button" data-action="remove-photo" data-index="${i}" aria-label="Удалить фото ${i+1}">${icon('close')}</button>${i===0?'<small>Обложка</small>':''}</div>`).join(''); }
async function optimizeImage(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>5*1024*1024) throw new Error('Выберите JPEG, PNG или WebP размером до 5 МБ.');
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));
  if(!blob)throw new Error('Не удалось обработать фото. Попробуйте другое изображение.');
  if(blob.size>2*1024*1024)throw new Error('После сжатия фото больше 2 МБ. Выберите изображение меньшего размера.');
  return blob;
}
async function uploadPhotos(input) {
  if(state.pending || !state.editor)return;
  const files=[...input.files];if(state.editor.images.length+files.length>8){toast('Можно добавить не больше 8 фотографий.');input.value='';return;}
  state.pending=true;const button=$('#product-form button[type=submit]');button.disabled=true;
  try { for(let i=0;i<files.length;i++){ $('#upload-status').textContent=`Загружаем фото ${i+1} из ${files.length}…`;const blob=await optimizeImage(files[i]);const {url}=await api('/admin/images',{method:'POST',file:blob});state.editor.images.push(url);renderPhotos(); } $('#upload-status').textContent='Фотографии загружены. Первое фото станет обложкой.'; }
  catch(e){$('#upload-status').textContent=e.message;}finally{state.pending=false;button.disabled=false;input.value='';}
}
async function submitProduct(form) {
  if(state.pending)return;
  if(!state.editor.images.length){form.querySelector('.form-error').textContent='Добавьте хотя бы одну фотографию.';return;}
  const v=Object.fromEntries(new FormData(form));state.pending=true;const button=form.querySelector('button[type=submit]');button.disabled=true;form.querySelector('.form-error').textContent='';
  try { await api(`/admin/products${state.editor.id ? '/'+state.editor.id : ''}`,{method:state.editor.id?'PUT':'POST',data:{name:v.name,description:v.description,category:v.category,price:Math.round(Number(v.price)*100),images:state.editor.images,active:v.active==='on'}});state.products=(await api('/products')).products;state.pending=false;closeSheet();await renderAdmin(routeVersion);toast('Товар сохранён'); }
  catch(e){form.querySelector('.form-error').textContent=e.message;}finally{state.pending=false;button.disabled=false;}
}
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;
  try {
    if(action==='add'){
      if(!add(el.dataset.id))return;
      if(el.closest('#sheet')){
        el.disabled=true;el.innerHTML=icon('check')+'Добавлено';el.classList.add('added');
        const message=document.createElement('p');message.className='added-confirmation';message.setAttribute('role','status');message.textContent='Товар добавлен в корзину';el.closest('.modal-content').append(message);
        setTimeout(()=>closeSheet(()=>toast('Товар добавлен в корзину')),280);
      }else toast('Товар добавлен в корзину');
    }
    if(action==='details')details(el.dataset.id);
    if(action==='collection'){event.preventDefault();scrollToCollection();}
    if(action==='category'){state.category=el.dataset.category;document.querySelectorAll('.chip').forEach(b=>{const active=b.dataset.category===state.category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});await smoothSwap($('#products'),renderProducts);}
    if(action==='reset-search'){state.query='';state.category='Все';await route();}
    if(action==='retry')await load();
    if(action==='reload-page')await route();
    if(action==='quantity'){const item=state.cart.find(i=>i.id===el.dataset.id);if(item){item.count=Math.min(99,item.count+Number(el.dataset.delta));state.cart=state.cart.filter(i=>i.count>0);persistCart();$('#app').innerHTML=cart();}}
    if(action==='remove'){state.cart=state.cart.filter(i=>i.id!==el.dataset.id);persistCart();$('#app').innerHTML=cart();}
    if(action==='checkout')checkout();
    if(action==='view-history'){closeSheet();location.hash='history';}
    if(action==='admin')location.hash='admin';
    if(action==='admin-section'){
      if(state.adminSection===el.dataset.section)return;
      state.adminSection=el.dataset.section;state.adminHTML=null;
      document.querySelectorAll('.admin-section').forEach(button=>{const active=button.dataset.section===state.adminSection;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
      await smoothSwap($('#admin-panel'),()=>{$('#admin-panel').innerHTML=state.adminPanels[state.adminSection];});
    }
    if(action==='refresh-admin'){el.disabled=true;await renderAdmin(routeVersion);}
    if(action==='review-order')reviewOrder(el.dataset.id,el.dataset.status);
    if(action==='more-admin-orders'){el.disabled=true;const r=await api('/admin/orders?offset='+state.adminOrders.length);state.adminOrders.push(...r.orders);state.adminHasMore=r.hasMore;$('#admin-orders').innerHTML=adminOrdersHTML();state.adminPanels.orders=$('#admin-panel').innerHTML;}
    if(action==='retry-notifications'){el.disabled=true;await api('/admin/notifications/retry',{method:'POST',data:{}});await renderAdmin(routeVersion);}
    if(action==='allow-notifications'){
      if(state.preview)toast('В Telegram здесь появится запрос на разрешение сообщений.');
      else if(telegram?.requestWriteAccess)telegram.requestWriteAccess(allowed=>toast(allowed?'Уведомления разрешены':'Заказ сохранится и без уведомлений. Статус — в профиле.'));
      else window.open('https://t.me/aquaservicer_bot','_blank','noopener');
    }
    if(action==='new-product')editor();
    if(action==='edit-product')editor(el.dataset.id);
    if(action==='remove-photo'&&!state.pending){state.editor.images.splice(Number(el.dataset.index),1);renderPhotos();}
    if(action==='photo')$('.gallery-track').scrollTo({left:$('.gallery-track').clientWidth*Number(el.dataset.index),behavior:'smooth'});
    if(action==='sync'){el.disabled=true;await api('/admin/sync',{method:'POST',data:{}});await renderAdmin(routeVersion);}
    if(action==='load-orders'){el.disabled=true;const r=await api(`/orders?offset=${state.orders.length}`);state.orders.push(...r.orders);state.hasMore=r.hasMore;$('#app').innerHTML=history();}
  } catch(e){toast(e.message);el.disabled=false;}
});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){state.query=event.target.value.trim();renderProducts();}
  if(event.target.name==='phone'){
    let digits=event.target.value.replace(/\D/g,'');
    if(digits.startsWith('380')&&digits.length>9)digits=digits.slice(3);
    event.target.value=digits.slice(0,9);
  }
});
document.addEventListener('change',event=>{if(event.target.id==='photos')uploadPhotos(event.target);});
document.addEventListener('paste',event=>{
  if(event.target.name!=='phone')return;
  event.preventDefault();
  let digits=(event.clipboardData?.getData('text')||'').replace(/\D/g,'');
  if(digits.startsWith('380')&&digits.length>=12)digits=digits.slice(3);
  event.target.value=digits.slice(0,9);
});
document.addEventListener('submit',event=>{if(event.target.id==='checkout-form'){event.preventDefault();submitCheckout(event.target);}if(event.target.id==='decision-form'){event.preventDefault();submitDecision(event.target);}if(event.target.id==='product-form'){event.preventDefault();submitProduct(event.target);}});
$('#close-sheet').addEventListener('click',closeSheet);
$('#sheet').addEventListener('cancel',event=>{event.preventDefault();closeSheet();});
$('#sheet').addEventListener('click',event=>{if(event.target===$('#sheet')){const r=$('#sheet').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSheet();}});
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement && !event.target.src.endsWith('/favicon.svg'))event.target.src='/favicon.svg';},true);
window.addEventListener('hashchange',()=>{route();});
window.addEventListener('storage',event=>{if(event.key==='watermar.cart.v2'){const c=readStore('watermar.cart.v2',[]);if(Array.isArray(c)){state.cart=c.filter(i=>typeof i?.id==='string'&&Number.isInteger(i.count)&&i.count>0&&i.count<=99).slice(0,50);updateBadge();if(state.tab==='cart')$('#app').innerHTML=cart();}}});
try { telegram?.BackButton?.onClick(()=>{if($('#sheet').open)closeSheet();else location.hash=state.tab==='history'||state.tab==='admin'?'profile':'catalog';}); } catch {}
updateBadge();route();load();




