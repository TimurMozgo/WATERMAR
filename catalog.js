// ==========================================
// КАТАЛОГ: ЗАГРУЗКА ДАННЫХ И ОТРИСОВКА
// ==========================================

const API_URL = 'https://tiktiok.xyz/webhook/997f03bf-9029-4117-935b-d9cfedfd92e6';
let allProducts = []; 
let cart = []; 
let currentQuantity = 1; // Глобальная переменная для счетчика в модалке

async function loadProducts() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allProducts = data;
        } else if (data.data && Array.isArray(data.data)) {
            allProducts = data.data;
        } else {
            allProducts = [data]; 
        }
        filterCatalog('all');
    } catch (error) {
        console.error("Ошибка при получении данных:", error);
    }
}

function filterCatalog(category) {
    const grid = document.getElementById('full-catalog-grid');
    if (!grid) return;

    grid.innerHTML = ''; 

    const filtered = category === 'all' 
        ? allProducts 
        : allProducts.filter(p => String(p.category).trim() === String(category).trim());

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1; padding:40px; color:#666;">Товаров пока нет.</p>`;
        return;
    }

    filtered.forEach(product => {
        grid.innerHTML += `
            <div class="product-card" id="card-${product.id}" onclick="prepareAddToCart('${product.id}')">
                <div class="product-image">
                    <img src="${product.photo}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300x300?text=Нет+фото'">
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description || 'Комплексная очистка для дома'}</p> 
                    <div class="product-footer">
                        <span class="price">${product.price} ₴</span>
                        <button class="add-to-cart-simple" onclick="event.stopPropagation(); prepareAddToCart('${product.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>`;
    });
    updateTabsUI(category);
}

// ПЕРВЫЙ ШАГ: Показываем Pop-up товара со счетчиком
function prepareAddToCart(productId) {
    const product = allProducts.find(p => String(p.id) === String(productId));
    if (!product) return;

    currentQuantity = 1; // Всегда сбрасываем на 1 при открытии
    const overlay = document.getElementById('product-confirm-overlay');
    const modalBody = document.getElementById('confirm-modal-body');

    if (overlay && modalBody) {
        modalBody.innerHTML = `
            <img src="${product.photo}" class="confirm-modal-img full-width" onerror="this.src='https://via.placeholder.com/400x300?text=Нет+фото'">
            
            <div class="confirm-modal-info-padding">
                <h2 class="confirm-modal-title">${product.name}</h2>
                <p class="confirm-modal-desc">${product.description || 'Комплексная очистка для дома. Идеальное решение для вашей квартиры.'}</p>
                
                <div class="modal-qty-container" style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 20px 0;">
                    <button onclick="updateModalQty(-1)" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: none; color: white; font-size: 20px; cursor: pointer;">−</button>
                    <span id="modal-qty-display" style="font-size: 22px; font-weight: bold; min-width: 30px; text-align: center;">1</span>
                    <button onclick="updateModalQty(1)" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: none; color: white; font-size: 20px; cursor: pointer;">+</button>
                </div>

                <div class="confirm-modal-price-bottom" id="modal-total-price">${product.price} ₴</div>
                
                <button class="btn-confirm-final" onclick="executeAddToCart('${product.id}')">
                    Добавить в корзину
                </button>
            </div>
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    }
}

// Функция обновления цифры в модалке
function updateModalQty(delta) {
    const display = document.getElementById('modal-qty-display');
    const priceDisplay = document.getElementById('modal-total-price');
    const productTitle = document.querySelector('.confirm-modal-title').innerText;
    const product = allProducts.find(p => p.name === productTitle);

    currentQuantity += delta;
    if (currentQuantity < 1) currentQuantity = 1;

    if (display) display.innerText = currentQuantity;
    if (priceDisplay && product) {
        priceDisplay.innerText = `${(Number(product.price) * currentQuantity).toLocaleString()} ₴`;
    }
}

function closeConfirmModal() {
    const overlay = document.getElementById('product-confirm-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ВТОРОЙ ШАГ: Реальное добавление с учетом количества
function executeAddToCart(productId) {
    const product = allProducts.find(p => String(p.id) === String(productId));
    if (product) {
        // Создаем копию товара с полем количества для корзины
        const itemToAdd = { ...product, quantity: currentQuantity };
        
        // Добавляем в массив корзины
        cart.push(itemToAdd);
        
        updateCartUI();
        showToast(`${product.name} x${currentQuantity}`);
        closeConfirmModal();

        const counter = document.querySelector('.cart-count');
        if (counter) {
            counter.style.transform = 'scale(1.3)';
            setTimeout(() => counter.style.transform = 'scale(1)', 200);
        }
    }
}

function updateTabsUI(category) {
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('onclick')?.includes(`'${category}'`)) {
            tab.classList.add('active');
        }
    });
}

// ==========================================
// ЛОГИКА КОРЗИНЫ И УВЕДОМЛЕНИЙ
// ==========================================

function openCart() {
    const overlay = document.getElementById('cart-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCart() {
    const overlay = document.getElementById('cart-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function showToast(productName) {
    const toast = document.getElementById('toast-added');
    const toastNameSpan = document.getElementById('toast-product-name');
    
    if (toast && toastNameSpan) {
        toastNameSpan.innerText = productName;
        toast.classList.remove('active');
        void toast.offsetWidth; 
        toast.classList.add('active');

        setTimeout(() => {
            toast.classList.remove('active');
        }, 3500);
    }
}

function updateCartUI() {
    const cartList = document.getElementById('cart-items-list');
    const cartCount = document.querySelector('.cart-count');
    const cartTotal = document.getElementById('cart-total');

    // Считаем общее кол-во предметов для иконки
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (cartCount) cartCount.innerText = totalItems;

    if (cartList) {
        let htmlContent = '';

        if (cart.length === 0) {
            htmlContent = '<p class="empty-msg" style="text-align:center; color:#666; padding:40px;">В корзине пока пусто</p>';
        } else {
            htmlContent = cart.map((item, index) => `
                <div class="cart-item">
                    <img src="${item.photo}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/60/252936/fff?text=?'">
                    <div class="cart-item-info">
                        <h4>${item.name}</h4>
                        <p>${item.quantity} шт. x ${item.price} ₴</p>
                    </div>
                    <button onclick="removeFromCart(${index})" style="background:none; border:none; color:rgba(255,255,255,0.2); font-size:20px; cursor:pointer; padding:5px;">&times;</button>
                </div>
            `).join('');
        }
        
        cartList.innerHTML = htmlContent;
    }

    const total = cart.reduce((sum, item) => sum + (Number(item.price) * (item.quantity || 1)), 0);
    if (cartTotal) cartTotal.innerText = `${total.toLocaleString()} ₴`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

document.addEventListener('DOMContentLoaded', loadProducts);

// МЕНЮ НАВИГАЦИИ
function openSideMenu() {
    const sideMenu = document.getElementById('side-menu-overlay');
    if (sideMenu) {
        sideMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSideMenu() {
    const sideMenu = document.getElementById('side-menu-overlay');
    if (sideMenu) {
        sideMenu.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ОФОРМЛЕНИЕ ЗАКАЗА
function openCheckout() {
    if (cart.length === 0) {
        alert("Сначала добавь что-то в корзину!");
        return;
    }
    
    const overlay = document.getElementById('checkout-overlay');
    overlay.classList.add('active');

    const phoneInput = document.getElementById('user-phone');
    
    let hint = document.getElementById('phone-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'phone-hint';
        hint.style.fontSize = '12px';
        hint.style.marginTop = '5px';
        hint.style.color = 'rgba(255,255,255,0.5)';
        phoneInput.parentNode.insertBefore(hint, phoneInput.nextSibling);
    }

    const updateHint = () => {
        const len = phoneInput.value.length;
        const target = 13; 
        
        if (len < target) {
            hint.innerText = `Нужно еще ${target - len} цифр (формат: +380...)`;
            hint.style.color = '#ff4d4d'; 
        } else if (len === target) {
            hint.innerText = `Отлично, номер заполнен!`;
            hint.style.color = '#4CAF50'; 
        } else {
            hint.innerText = `Слишком много цифр (${len} из ${target})`;
            hint.style.color = '#ff4d4d';
        }
    };

    phoneInput.addEventListener('input', updateHint);
    updateHint(); 
}

function closeCheckout() {
    document.getElementById('checkout-overlay').classList.remove('active');
    setTimeout(() => {
        document.getElementById('checkout-form-container').style.display = 'block';
        document.getElementById('checkout-success').style.display = 'none';
    }, 500);
}

// ОТПРАВКА В n8n И СОХРАНЕНИЕ В ИСТОРИЮ (АУДИТОР)
async function sendOrderToN8N() {
    const name = document.getElementById('user-name').value;
    const phone = document.getElementById('user-phone').value;
    const btn = document.getElementById('submit-order-btn');
    const formContent = document.getElementById('checkout-form-container');
    const successContent = document.getElementById('checkout-success');

    const ORDER_API_URL = 'https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698';

    if (!name || !phone) {
        alert("Заполни все поля, бро!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "ОТПРАВКА...";

    const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) * (item.quantity || 1)), 0);
    const orderData = {
        customer_name: name,
        customer_phone: phone,
        items: cart,
        total_price: totalPrice,
        order_date: new Date().toLocaleString()
    };

    try {
        const response = await fetch(ORDER_API_URL, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            // --- ЛОГИКА АУДИТОРА: СОХРАНЯЕМ В ЛОКАЛЬНУЮ ИСТОРИЮ ---
            const newOrder = {
                date: new Date().toLocaleDateString('uk-UA'),
                item: cart.map(i => `${i.name} (${i.quantity} шт.)`).join(', '),
                price: totalPrice.toLocaleString() + ' ₴'
            };

            const history = JSON.parse(localStorage.getItem('user_orders') || '[]');
            history.unshift(newOrder);
            localStorage.setItem('user_orders', JSON.stringify(history));
            // ---------------------------------------------------

            formContent.style.display = 'none';
            successContent.style.display = 'block';
            cart = []; 
            updateCartUI();
        } else {
            throw new Error("Ошибка сервера");
        }
    } catch (error) {
        console.error("Ошибка при отправке заказа:", error);
        alert("Что-то пошло не так. Попробуй еще раз.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Отправить заявку";
    }
}

// ==========================================
// ФУНКЦИИ ИСТОРИИ ЗАКАЗОВ (АУДИТОР)
// ==========================================

function showOrders() {
    closeSideMenu(); // Закрываем боковое меню перед открытием истории
    const ordersOverlay = document.getElementById('orders-overlay');
    if (ordersOverlay) {
        ordersOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderOrdersList(); 
    }
}

function closeOrders() {
    const ordersOverlay = document.getElementById('orders-overlay');
    if (ordersOverlay) {
        ordersOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function renderOrdersList() {
    const list = document.getElementById('orders-list');
    if (!list) return;

    // Читаем реальные данные, которые сохранили в sendOrderToN8N
    const savedOrders = JSON.parse(localStorage.getItem('user_orders') || '[]');

    if (savedOrders.length > 0) {
        list.innerHTML = savedOrders.map(order => `
            <div class="order-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 15px; padding: 18px; margin-bottom: 12px;">
                <div style="text-align: right; font-size: 11px; color: #46a1df; margin-bottom: 8px; font-weight: 800;">
                    ${order.date}
                </div>
                <div style="font-size: 14px; color: white; line-height: 1.4;">
                    ${order.item}
                    <div style="margin-top: 10px; font-size: 18px; font-weight: 800; color: #fff;">${order.price}</div>
                </div>
            </div>
        `).join('');
    } else {
        list.innerHTML = '<p style="text-align:center; color:rgba(255,255,255,0.3); margin-top:40px;">История пуста</p>';
    }
}