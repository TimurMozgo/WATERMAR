/**
 * CATALOG.JS — Сердце магазина
 */

// 1. БАЗА ДАННЫХ ТОВАРОВ (Сейчас пустая, как ты и просил)
// СЮДА ставить логику получения данных: fetch('ТВОЙ_API_URL')
const products = []; 

// 2. СОСТОЯНИЕ КОРЗИНЫ
let cart = JSON.parse(localStorage.getItem('aqua_cart')) || [];

// --- ЛОГИКА ИНТЕРФЕЙСА (БУРГЕР И КОРЗИНА) ---

function toggleMenu() {
    document.getElementById('side-menu').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
}

// Добавление товара
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    cart.push({
        ...product,
        orderDate: new Date().toLocaleString()
    });

    localStorage.setItem('aqua_cart', JSON.stringify(cart));
    updateCartUI();
    
    // Открываем корзину, чтобы показать, что товар добавился
    toggleCart();
}

// Обновление интерфейса корзины

function updateCartUI() {
    const cartContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const badge = document.querySelector('.cart-badge');

    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="empty-msg" style="text-align:center; color:#616161; margin-top:50px;">В корзине пока пусто</p>';
    } else {
        cartContainer.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-title">${item.title}</span>
                    <span class="cart-item-price">${item.price.toLocaleString()} ₴</span>
                </div>
                <button type="button" class="remove-item" onclick="removeFromCart(${index})">&times;</button>
            </div>
        `).join('');
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    cartTotal.innerText = total.toLocaleString();
    if (badge) badge.innerText = cart.length;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('aqua_cart', JSON.stringify(cart));
    updateCartUI();
}

// --- ОТРИСОВКА КАТАЛОГА ---

function renderCatalog(filterCategory = 'all') {
    const container = document.getElementById('product-container');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = '<p class="empty-msg">Товары загружаются или отсутствуют...</p>';
        return;
    }

    const filtered = filterCategory === 'all' 
        ? products 
        : products.filter(item => item.category === filterCategory);

    container.innerHTML = filtered.map(item => `
        <div class="product-card">
            <div class="product-img-box">
                <img src="${item.img}" class="product-img">
            </div>
            <span class="product-category">${item.categoryName}</span>
            <h3 class="product-title">${item.title}</h3>
            <p class="product-desc">${item.desc}</p>
            <div class="product-price">${item.price.toLocaleString()} ₴</div>
            <button class="buy-btn" onclick="addToCart(${item.id})">
                В корзину
            </button>
        </div>
    `).join('');
}

// --- АВТОМАТИЗАЦИЯ (КУДА СТАВИТЬ КЛЮЧ) ---

/**
 * Функция для загрузки товаров извне (Google Sheets, n8n, Airtable)
 */
async function fetchProducts() {
    try {
        const API_URL = 'https://tiktiok.xyz/webhook/997f03bf-9029-4117-935b-d9cfedfd92e6'; 
        
        const response = await fetch(API_URL);
        const data = await response.json();

        products = data; 
        renderCatalog(); 
    } catch (error) {
        console.log("Ждем данные от бота...");
    }
}

// --- ЗАПУСК ---
document.addEventListener('DOMContentLoaded', () => {
    renderCatalog();
    updateCartUI();
    
    // Закрытие по клику на оверлей
    document.getElementById('overlay').addEventListener('click', () => {
        document.getElementById('side-menu').classList.remove('active');
        document.getElementById('cart-sidebar').classList.remove('active');
        document.getElementById('overlay').classList.remove('active');
    });
});