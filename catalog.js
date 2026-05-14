/**
 * CATALOG.JS — Полная версия с кнопкой "Подробнее"
 */

let products = []; 

// ПРАВИЛЬНО: Сначала берем из памяти, потом создаем переменную
const savedCart = JSON.parse(localStorage.getItem('aqua_cart')) || [];
window.cart = savedCart;

// --- ЛОГИКА ИНТЕРФЕЙСА ---

function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('overlay');
    if (menu) menu.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// Добавление в корзину + уведомление
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Ищем, есть ли уже такой товар в корзине
    const existingItem = window.cart.find(item => item.id === productId);

    if (existingItem) {
        // Если есть — просто плюсуем
        existingItem.count = (existingItem.count || 1) + 1;
    } else {
        // Если нет — добавляем новый с count: 1
        window.cart.push({ ...product, count: 1 });
    }

    localStorage.setItem('aqua_cart', JSON.stringify(window.cart));
    updateCartUI();
    showToast(`${product.name} добавлен в корзину!`);
}

// / ПОИСКОВАЯ СТРОКА

function searchProducts() {
    const query = document.getElementById('product-search').value.toLowerCase().trim();
    const cards = document.querySelectorAll('.product-card'); 

    cards.forEach(card => {
        const titleContainer = card.querySelector('.product-title');
        
        if (titleContainer) {
            const title = titleContainer.innerText.toLowerCase();
            
            // Разбиваем название на отдельные слова
            const words = title.split(' ');
            
            // Проверяем: начинается ли ХОТЯ БЫ ОДНО слово с того, что мы ввели
            const isMatch = words.some(word => word.startsWith(query));
            
            if (isMatch) {
                card.style.display = ""; // Показываем
            } else {
                card.style.display = "none"; // Скрываем
            }
        }
    });
}

// 1. Изменение количества товара
function updateQuantity(index, delta) {
    if (window.cart[index]) {
        // Используем ТОЛЬКО count
        let currentCount = window.cart[index].count || 1;
        currentCount += delta;
        
        if (currentCount <= 0) {
            window.cart.splice(index, 1);
        } else {
            window.cart[index].count = currentCount;
        }
        
        localStorage.setItem('aqua_cart', JSON.stringify(window.cart));
        updateCartUI();
    }
}

// 2. Открытие модалки (Универсальное)
function openOrderModal() {
    console.log("Запуск оформления...");
    const modal = document.getElementById('order-modal');
    const sidebar = document.getElementById('cart-sidebar');
    
    // Проверяем оба варианта ID оверлея, которые у тебя встречаются
    const overlay = document.getElementById('overlay') || document.getElementById('cart-overlay');

    if (modal) {
        // Прячем корзину и фон
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        
        // Разблокируем скролл (если был заблокирован корзиной)
        document.body.style.overflow = ''; 

        // Включаем модалку (используем flex для центрирования из нашего нового CSS)
        modal.style.display = 'flex';
        
        // Добавляем класс для анимации появления (если есть в CSS)
        setTimeout(() => modal.classList.add('active'), 10);
    } else {
        console.error("Критическая ошибка: order-modal не найден!");
    }
}

// 3. Закрытие модалки
function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300); // Задержка для плавной анимации
    }
}

// 4. Отправка заказа
async function submitOrder() {
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const toast = document.getElementById('success-message');

    if (!nameInput || !phoneInput) return;

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name || !phone) {
        alert("Пожалуйста, заполните все поля.");
        return;
    }

    // 1. Сбор актуальных данных из корзины

    const currentCart = JSON.parse(localStorage.getItem('aqua_cart')) || [];
    const total = currentCart.reduce((sum, item) => sum + (item.price * (item.count || 1)), 0);

    // 2. Отправка данных на вебхук n8n
    try {
        // Мы не используем await перед fetch, чтобы не заставлять клиента ждать ответа сервера
        fetch('https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "Product Order",
                customer_name: name,
                customer_phone: phone,
                order_items: currentCart,
                total_amount: total,
                page_url: window.location.href
            })
        });
        console.log("Данные успешно переданы в обработку");
    } catch (error) {
        console.error("Ошибка сети при отправке заказа:", error);
    }

    // 3. Закрытие формы и уведомление
    closeOrderModal();

    if (toast) {
        toast.classList.add('active');
    }

    // 4. Очистка данных
    localStorage.removeItem('aqua_cart');
    
    // 5. Перезагрузка страницы через 3 секунды
    setTimeout(() => {
        if (toast) toast.classList.remove('active');
        location.reload();
    }, 3000);
}

// Уведомление (Toast)
function showToast(name) {
    let toast = document.querySelector('.toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <div class="toast-icon"><i data-lucide="check"></i></div>
        <div class="toast-content">
            <span class="toast-status">Добавлено!</span>
            <span class="toast-product-name">${name}</span>
        </div>
        <div class="toast-progress"></div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Обновление интерфейса корзины
function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const badges = document.querySelectorAll('.cart-badge');

    if (cartContainer) {
        if (window.cart.length === 0) {
            cartContainer.innerHTML = '<p class="empty-msg" style="text-align:center; color:var(--gray); margin-top:50px;">В корзине пока пусто</p>';
        } else {
            cartContainer.innerHTML = window.cart.map((item, index) => `
                <div class="cart-item" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 15px 0;">
                    <div class="cart-item-img">
                        <img src="${item.photo}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60x60?text=?'" style="border-radius: 10px;">
                    </div>
                    <div class="cart-item-info">
                        <span class="cart-item-title" style="color:var(--text-main); font-weight:600;">${item.name}</span>
                        <!-- ЦЕНА ТЕПЕРЬ СИНЯЯ -->
                        <span class="cart-item-price" style="color:var(--accent); font-weight:700;">${Number(item.price).toLocaleString()} ₴</span>
                        
                        <!-- УПРАВЛЕНИЕ КОЛИЧЕСТВОМ В ЦВЕТЕ --card -->
                        <div class="cart-item-qty" style="display:flex; align-items:center; gap:12px; background:var(--card); padding:8px 12px; border-radius:10px; width:fit-content; margin-top:8px; border: 1px solid rgba(255,255,255,0.05);">
                            <button onclick="updateQuantity(${index}, -1)" style="color:var(--accent); background:none; border:none; cursor:pointer; font-size:18px; font-weight:bold;">−</button>
                            <span style="color:var(--text-main); font-weight:600;">${item.count || 1}</span>
                            <button onclick="updateQuantity(${index}, 1)" style="color:var(--accent); background:none; border:none; cursor:pointer; font-size:18px; font-weight:bold;">+</button>
                        </div>
                    </div>
                    <button type="button" class="remove-item" onclick="removeFromCart(${index})" style="color:#ff4d4d; opacity:0.7;">&times;</button>
                </div>
            `).join('');
        }
    }

    const total = window.cart.reduce((sum, item) => sum + (Number(item.price) * (item.count || 1)), 0);
    if (cartTotal) cartTotal.innerText = total.toLocaleString();

    const totalItemsCount = window.cart.reduce((sum, item) => sum + (item.count || 1), 0);
    badges.forEach(badge => { 
        badge.innerText = totalItemsCount; 
    });
}

function removeFromCart(index) {
    // Удаляем элемент из глобального массива
    window.cart.splice(index, 1);
    
    // Сразу сохраняем обновленный массив в память
    localStorage.setItem('aqua_cart', JSON.stringify(window.cart));
    
    // Перерисовываем корзину, чтобы товар исчез с экрана
    updateCartUI();
}

// --- ЛОГИКА МОДАЛЬНОГО ОКНА (ПОДРОБНЕЕ) ---

// Создаем структуру модалки динамически при загрузке скрипта
if (!document.getElementById('productModal')) {
    document.body.insertAdjacentHTML('beforeend', `
        <div id="productModal" class="modal">
            <div class="modal-content">
                <span class="close-modal" onclick="closeModal()">&times;</span>
                <img id="modalImg" class="modal-img" src="" alt="">
                <h2 id="modalTitle" class="modal-title"></h2>
                <p id="modalDesc" class="modal-desc"></p>
                <div id="modalPrice" style="font-size: 22px; font-weight: 700; color: #8b5cf6; margin-top: 15px;"></div>
            </div>
        </div>
    `);
}

function openModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('modalImg').src = product.photo;
    document.getElementById('modalTitle').innerText = product.name;
    document.getElementById('modalDesc').innerText = product.description;
    document.getElementById('modalPrice').innerText = `${Number(product.price).toLocaleString()} ₴`;

    document.getElementById('productModal').classList.add('active');
    document.body.style.overflow = 'hidden'; // Отключаем скролл сайта
}

function closeModal() {
    document.getElementById('productModal').classList.remove('active');
    document.body.style.overflow = 'auto'; // Включаем скролл обратно
}

// --- ОТРИСОВКА КАТАЛОГА ---

function renderCatalog(filterCategory = 'all') {
    const container = document.getElementById('product-container');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<p class="empty-msg">Загрузка...</p>';
        return;
    }

    const filtered = filterCategory === 'all' 
        ? products 
        : products.filter(item => String(item.category || "").trim().toLowerCase() === String(filterCategory).trim().toLowerCase());

    container.innerHTML = filtered.map(item => `
        <div class="product-card">
            <div class="product-img-box">
                <img src="${item.photo}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/300x300?text=No+Photo'">
            </div>
            <div class="product-content">
                <span class="cat">${item.category}</span>
                <h3 class="product-title">${item.name}</h3>
                <p class="product-desc">${item.description}</p>
                <div class="price">${Number(item.price).toLocaleString()} ₴</div>
                
                <!-- НОВАЯ КНОПКА ПОДРОБНЕЕ -->
                <button class="details-btn" onclick="openModal(${item.id})">
                    Подробнее
                </button>
                
                <button class="add-btn" onclick="addToCart(${item.id})">
                    В корзину
                </button>
            </div>
        </div>
    `).join('');
}

// --- ЗАГРУЗКА ДАННЫХ ---

async function fetchProducts() {
    try {
        const API_URL = 'https://tiktiok.xyz/webhook/997f03bf-9029-4117-935b-d9cfedfd92e6'; 
        const response = await fetch(API_URL);
        const data = await response.json();
        products = Array.isArray(data) ? data : (data.data || []); 
        renderCatalog(); 
    } catch (error) {
        console.error("Ошибка загрузки:", error);
    }
}

// --- ЗАПУСК ПРИ ЗАГРУЗКЕ ---
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts(); 
    updateCartUI();
    
    // Категории
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderCatalog(this.getAttribute('data-category'));
        });
    });

    // Закрытие модалки при клике на темный фон
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('productModal');
        if (event.target === modal) closeModal();
    });
});