/**
 * CATALOG.JS — Полная версия с кнопкой "Подробнее"
 */

let products = []; 

// 1. Инициализация корзины
if (typeof cart === 'undefined') {
    window.cart = JSON.parse(localStorage.getItem('aqua_cart')) || [];
}

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

    cart.push(product);
    localStorage.setItem('aqua_cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${product.name} добавлен в корзину!`);
}

// Уведомление (Toast)
function showToast(message) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Обновление интерфейса корзины
function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const badges = document.querySelectorAll('.cart-badge');

    if (cartContainer) {
        if (cart.length === 0) {
            cartContainer.innerHTML = '<p class="empty-msg" style="text-align:center; color:#616161; margin-top:50px;">В корзине пока пусто</p>';
        } else {
            cartContainer.innerHTML = cart.map((item, index) => `
                <div class="cart-item">
                    <div class="cart-item-img">
                        <img src="${item.photo}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60x60?text=?'">
                    </div>
                    <div class="cart-item-info">
                        <span class="cart-item-title">${item.name}</span>
                        <span class="cart-item-price">${Number(item.price).toLocaleString()} ₴</span>
                    </div>
                    <button type="button" class="remove-item" onclick="removeFromCart(${index})">&times;</button>
                </div>
            `).join('');
        }
    }

    const total = cart.reduce((sum, item) => sum + Number(item.price), 0);
    if (cartTotal) cartTotal.innerText = total.toLocaleString();
    badges.forEach(badge => { badge.innerText = cart.length; });
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('aqua_cart', JSON.stringify(cart));
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