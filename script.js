// ==========================================
// 1. НАСТРОЙКИ И ДАННЫЕ
// ==========================================
const WEBHOOK_URL = 'https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698';

const productsData = {
    'osmosis': { 
        title: 'Watermar 5-50', 
        price: 9903, 
        desc: '180$ + 25$(1000 монтаж). Без минерализатора, кран капля, бак 12 л', 
        img: '1.png' 
    },
    'softener': { 
        title: 'Watermar 6-50 P', 
        price: 14100, 
        desc: '260$ + 30$ (1500 грн. монтаж). С насосом, минерализатором и рН корректором', 
        img: '2.png' 
    },
    'column': { 
        title: 'Watermar 6-50 PpH "La Perla"', 
        price: 14963, 
        desc: '260$+ 50$ (рН)+ 35$ (1700 грн. монтаж). С насосом и минерализатором', 
        img: '3.png' 
    }
};

let cart = []; // Корзина

document.addEventListener('DOMContentLoaded', () => {
    const logo = document.getElementById('main-logo');
    const orderForm = document.getElementById('order-form');

    // 2. ПРИВЯЗКА КНОПОК УСЛУГ
    document.getElementById('master-btn')?.addEventListener('click', () => openModal('master'));
    document.getElementById('analysis-btn')?.addEventListener('click', () => openModal('analysis'));
    document.getElementById('call-btn')?.addEventListener('click', () => openModal('call'));

    // Логика логотипа
    logo?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        closeModal();
    });

    // 3. ОБРАБОТЧИК ОТПРАВКИ (n8n "Аудитор")
    orderForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = orderForm.querySelector('.btn-submit');
        const originalBtnText = submitBtn.innerHTML;

        let totalSum = 0;
        const productsList = cart.map((item, index) => {
            // ФИКС: Умная проверка. Если число - берем число, если строка - чистим.
            const priceNum = typeof item.price === 'number' ? item.price : parseInt(item.price.toString().replace(/\s/g, '')) || 0;
            totalSum += priceNum;
            return `${index + 1}. ${item.title}`;
        }).join('\n');

        const serviceMapping = {
            'master': 'Вызвать мастера на объект',
            'analysis': 'Записаться на анализ воды',
            'call': 'Заказать звонок с мастером',
            'cart_checkout': 'Оформление заказа из корзины'
        };

        const currentServiceId = orderForm.dataset.service || 'common';
        const finalServiceName = serviceMapping[currentServiceId] || 'Общая заявка';

        const formData = {
            name: document.getElementById('user-name').value,
            phone: document.getElementById('user-phone').value,
            service: finalServiceName,
            products: productsList.trim() !== "" ? productsList : finalServiceName,
            totalPrice: totalSum > 0 ? totalSum.toLocaleString() + ' ₴' : '—',
            date: new Date().toLocaleString()
        };

        try {
            submitBtn.innerHTML = 'Отправка...';
            submitBtn.disabled = true;

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // --- ЛОГИКА АУДИТОРА: СОХРАНЕНИЕ В ИСТОРИЮ (БЕЗ НОМЕРОВ) ---
                const newOrder = {
                    date: new Date().toLocaleDateString('uk-UA'),
                    item: formData.products.replace(/\d+\.\s/g, '').replace(/\n/g, ', '), 
                    price: formData.totalPrice
                };

                const history = JSON.parse(localStorage.getItem('user_orders') || '[]');
                history.unshift(newOrder);
                localStorage.setItem('user_orders', JSON.stringify(history));
                // ---------------------------------------------------------

                cart = [];
                updateCartUI();
                closeModal();
                closeCart();
                showSuccessToast('Заявка принята!', 'Мы свяжемся с вами скоро', false);
                orderForm.reset();
            } else {
                throw new Error('Server Error');
            }

        } catch (error) {
            console.error('Ошибка:', error);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]); 
            showSuccessToast('Сервер недоступен', 'Попробуйте пожалуйста через пару минут', true);
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

// 4. ФУНКЦИИ КОРЗИНЫ
function openCart() {
    const overlay = document.getElementById('cart-modal-overlay');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateCartUI();
}

function closeCart() {
    document.getElementById('cart-modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function addToCart(id) {
    const product = productsData[id];
    if (product) {
        cart.push(product);
        updateCartUI();
        closeProductModal();
        showSuccessToast('Добавлено!', `${product.title} теперь в корзине`);
    }
}

function updateCartUI() {
    const countLabel = document.getElementById('cart-count');
    const list = document.getElementById('cart-items-list');
    const totalBlock = document.getElementById('cart-total-block');
    const totalPriceSum = document.getElementById('total-price-sum');
    
    if (countLabel) countLabel.textContent = cart.length;
    if (cart.length === 0) {
        if (list) list.innerHTML = '<p style="color: #666; text-align: center; padding: 40px 20px;">Корзина пока пуста...</p>';
        if (totalBlock) totalBlock.style.display = 'none';
        return;
    }
    
    if (totalBlock) totalBlock.style.display = 'block';
    
    if (list) {
        list.innerHTML = '';
        let total = 0;
        cart.forEach((item, index) => {
            // ФИКС: Берем цену напрямую, так как это число
            const priceValue = typeof item.price === 'number' ? item.price : parseInt(item.price.toString().replace(/\s/g, '')) || 0;
            total += priceValue;
            const imgSrc = item.img.includes('http') ? item.img : `./img/${item.img}`;

            list.innerHTML += `
                <div class="cart-item-row">
                    <div class="cart-item-content">
                        <div class="cart-item-img-container"><img src="${imgSrc}" alt="${item.title}"></div>
                        <div class="cart-item-details">
                            <div class="cart-item-title">${item.title}</div>
                            <div class="cart-item-info-line">1 шт. x ${item.price.toLocaleString()} ₴</div>
                        </div>
                    </div>
                    <button class="cart-item-remove" onclick="removeFromCart(${index})">&times;</button>
                </div>`;
        });
        if (totalPriceSum) totalPriceSum.textContent = total.toLocaleString() + ' ₴';
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function checkoutCart() {
    if (cart.length === 0) return;
    openModal('cart_checkout');
}

// 5. ФУНКЦИИ МОДАЛОК
function openModal(type) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const serviceNames = { 'master': 'Вызов мастера', 'analysis': 'Анализ воды', 'call': 'Заказать звонок', 'cart_checkout': 'Оформление заказа' };
    
    if (title) title.textContent = serviceNames[type] || 'Заявка';
    document.getElementById('order-form').dataset.service = type;
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}



function closeProductModal() {
    document.getElementById('product-modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

// Закрытие по клику на фон
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
            closeProductModal();
            closeCart();
            closeOrders(); 
        }
    });
});

function openProductModal(id) {
    const product = productsData[id];
    const content = document.getElementById('product-detail-content');
    const overlay = document.getElementById('product-modal-overlay');

    if (content && product) {
        const imagePath = `./img/${product.img}`; 
        
        content.classList.add('product-mode');

        // ПЕРЕСТАВИЛИ: Сначала описание, потом цена
        content.innerHTML = `
            <div class="modal-image-container">
                <img src="${imagePath}" alt="${product.title}" class="modal-top-img">
            </div>
            
            <div class="modal-text-section">
                <h2 class="modal-title">${product.title}</h2>
                
                <p class="modal-subtitle">${product.desc}</p>
                
                <div class="price-large" style="margin-top: 10px;">${product.price.toLocaleString()} ₴</div>
                
                <button class="btn-add-cart" style="width: 100%; margin: 0;" onclick="addToCart('${id}')">
                    Добавить в корзину
                </button>
            </div>`;
        
        overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// content.classList.remove('product-mode'); // Это вернет отступы

// 6. УВЕДОМЛЕНИЯ
function showSuccessToast(title, desc, isError = false) {
    const toast = document.getElementById('toast');
    const tTitle = document.querySelector('.toast-title');
    const tDesc = document.querySelector('.toast-desc');
    const tIcon = document.querySelector('.toast-icon');
    
    // Если иконки нет в HTML, скрипт всё равно должен показать плашку
    if (toast && tTitle && tDesc) {
        tTitle.textContent = title;
        tDesc.textContent = desc;
        isError ? toast.classList.add('error') : toast.classList.remove('error');
        if (tIcon) tIcon.textContent = isError ? '✕' : '✓';
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 4000);
    }
}

// 7. КАТАЛОГ ТОВАРОВ ФУЛЛ 
function openCatalog() {
    const home = document.getElementById('home-page');
    const catalog = document.getElementById('full-catalog-page');
    if (home && catalog) {
        home.style.display = 'none';
        catalog.style.display = 'block';
        window.scrollTo(0, 0);
        filterCatalog('all');
    }
}

function closeCatalog() {
    const home = document.getElementById('home-page');
    const catalog = document.getElementById('full-catalog-page');
    if (home && catalog) {
        catalog.style.display = 'none';
        home.style.display = 'block';
        document.body.style.overflow = '';
    }
}

function filterCatalog(category = 'all') {
    const grid = document.getElementById('full-catalog-grid');
    if (!grid) return;
    grid.innerHTML = ''; 
    const productsArray = Object.values(productsData);
    const filtered = category === 'all' ? productsArray : productsArray.filter(p => p.category === category);

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color: #666; text-align: center; grid-column: 1/-1; padding: 40px;">Товары скоро появятся...</p>';
        return;
    }

    filtered.forEach(product => {
        const id = Object.keys(productsData).find(key => productsData[key] === product);
        // ФИКС: Красивый вывод цены в карточке каталога
        grid.innerHTML += `
            <div class="product-card" onclick="openProductModal('${id}')">
                <div class="product-img-wrapper"><img src="./img/${product.img}" alt="${product.title}" loading="lazy"></div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-price-row">
                        <span class="product-price">${product.price.toLocaleString()} ₴</span>
                        <button class="add-quick-btn" onclick="event.stopPropagation(); addToCart('${id}')">+</button>
                    </div>
                </div>
            </div>`;
    });
}

// 8. БУРГЕР И ИСТОРИЯ ЗАКАЗОВ (АУДИТОР)
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

function showOrders() {
    closeSideMenu(); 
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

    // Читаем реальные данные из памяти
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