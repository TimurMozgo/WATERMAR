export const ADMIN_IDS = new Set(['394814448', '6088315974']);
export const CATEGORIES = ['Оборудование', 'Расходные материалы', 'Услуги'];
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const fail = (status, message) => { throw new HttpError(status, message); };
export function text(value, max, label, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `Проверьте поле «${label}».`);
  return value.trim();
}
export function validateProduct(input) {
  const name = text(input.name, 150, 'Название');
  const description = text(input.description, 5000, 'Описание');
  if (!CATEGORIES.includes(input.category)) fail(400, 'Выберите категорию.');
  if (!Number.isSafeInteger(input.price) || input.price < 0 || input.price > 100000000) fail(400, 'Некорректная цена.');
  if (!Array.isArray(input.images) || input.images.length < 1 || input.images.length > 8) fail(400, 'Добавьте от 1 до 8 фотографий.');
  if (input.images.some(url => typeof url !== 'string' || !/^\/media\/[a-f0-9-]+\.(webp|jpg|png)$/.test(url))) fail(400, 'Загрузите фотографии через приложение.');
  return { name, description, category: input.category, price: input.price, images: [...new Set(input.images)], active: input.active === false ? 0 : 1 };
}
export function validateCheckout(input) {
  const name = text(input.name, 100, 'Имя', 2);
  const phone = text(input.phone, 30, 'Телефон').replace(/[\s()\-]/g, '');
  if (!/^\+380\d{9}$/.test(phone)) fail(400, 'После +380 должно быть ровно 9 цифр.');
  const requestKey = text(input.requestKey, 80, 'Номер запроса');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestKey)) fail(400, 'Некорректный номер запроса.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) fail(400, 'Добавьте товары в корзину.');
  const seen = new Set();
  const items = input.items.map(item => {
    if (typeof item.id !== 'string' || item.id.length > 80 || seen.has(item.id) || !Number.isInteger(item.count) || item.count < 1 || item.count > 99) fail(400, 'Проверьте количество товаров.');
    seen.add(item.id); return { id: item.id, count: item.count };
  });
  if (!Number.isSafeInteger(input.quotedTotal) || input.quotedTotal < 0) fail(400, 'Обновите корзину перед оформлением.');
  return { name, phone, requestKey, items, quotedTotal: input.quotedTotal };
}
export function priceOrder(items, products) {
  const lines = items.map(item => {
    const product = products.find(p => p.id === item.id && p.active);
    if (!product) fail(409, 'Один из товаров больше недоступен. Обновите каталог.');
    return { id: product.id, name: product.name, price: product.price, count: item.count, image: JSON.parse(product.images)[0] || '' };
  });
  return { lines, total: lines.reduce((sum, item) => sum + item.price * item.count, 0) };
}
