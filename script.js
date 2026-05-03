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

// Инициализация корзины из памяти
let cart = JSON.parse(localStorage.getItem('watermar_cart')) || [];
window.currentQuantity = 1;

document.addEventListener('DOMContentLoaded', () => {
    const logo = document.getElementById('main-logo');
    const orderForm = document.getElementById('order-form');

    // Синхронизируем интерфейс сразу при загрузке любой страницы
    updateCartUI();

    // Привязка кнопок услуг
    document.getElementById('master-btn')?.addEventListener('click', () => openModal('master'));
    document.getElementById('analysis-btn')?.addEventListener('click', () => openModal('analysis'));
    document.getElementById('call-btn')?.addEventListener('click', () => openModal('call'));

    logo?.addEventListener('click', () => {
        if (document.getElementById('full-catalog-page')?.style.display === 'block') {
            closeCatalog();
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        closeModal();
    });

    // Обработчик формы заказа (n8n Аудитор)
    orderForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = orderForm.querySelector('.btn-submit');
        const originalBtnText = submitBtn.innerHTML;

        let totalSum = 0;
        const productsList = cart.map((item, index) => {
            const itemTotal = item.price * (item.quantity || 1);
            totalSum += itemTotal;
            return `${index + 1}. ${item.title} (${item.quantity} шт.)`;
        }).join('\n');

        const serviceMapping = {
            'master': 'Вызвать мастера на объект',
            'analysis': 'Записаться на анализ воды',
            'call': 'Заказать звонок с мастером',
            'cart_checkout': 'Оформление заказа из корзины'
        };

        const currentServiceId = orderForm.dataset.service || 'common';
        const formData = {
            name: document.getElementById('user-name').value,
            phone: document.getElementById('user-phone').value,
            service: serviceMapping[currentServiceId] || 'Общая заявка',
            products: productsList.trim() !== "" ? productsList : "Услуга: " + (serviceMapping[currentServiceId] || 'Общая'),
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
                const newOrder = {
                    date: new Date().toLocaleDateString('uk-UA'),
                    item: formData.products.replace(/\d+\.\s/g, '').replace(/\n/g, ', '), 
                    price: formData.totalPrice
                };
                const history = JSON.parse(localStorage.getItem('user_orders') || '[]');
                history.unshift(newOrder);
                localStorage.setItem('user_orders', JSON.stringify(history));

                cart = [];
                localStorage.removeItem('watermar_cart');
                
                updateCartUI();
                closeModal();
                closeCart();
                showSuccessToast('Заявка принята!', 'Мы свяжемся с вами скоро', false);
                orderForm.reset();
            } else { throw new Error('Ошибка сервера'); }
        } catch (error) {
            showSuccessToast('Сервер недоступен', 'Попробуйте позже', true);
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
    
    manageChatButton();
});

// ==========================================
// 4. ФУНКЦИИ КОРЗИНЫ
// ==========================================
function openCart() {
    document.getElementById('cart-modal-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateCartUI();
}

function closeCart() {
    document.getElementById('cart-modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function addToCart(id) {
    const product = productsData[id];
    if (!product) return;

    // Считываем свежие данные из памяти перед изменением
    cart = JSON.parse(localStorage.getItem('watermar_cart')) || [];
    
    const existingItem = cart.find(item => item.id === id);
    const qtyToAdd = window.currentQuantity || 1;

    if (existingItem) {
        existingItem.quantity += qtyToAdd;
    } else {
        cart.push({
            id: id,
            title: product.title,
            price: product.price,
            img: product.img,
            quantity: qtyToAdd
        });
    }

    localStorage.setItem('watermar_cart', JSON.stringify(cart));
    window.currentQuantity = 1; 
    
    updateCartUI();
    closeProductModal();
    showSuccessToast('Добавлено!', product.title, false);
}

function updateCartUI() {
    // Подтягиваем актуальное состояние
    cart = JSON.parse(localStorage.getItem('watermar_cart')) || [];
    
    const countLabels = document.querySelectorAll('#cart-count'); // Ищем все счетчики (и в каталоге, и на главной)
    const lists = document.querySelectorAll('#cart-items-list'); // Ищем все списки
    const totalBlocks = document.querySelectorAll('#cart-total-block');
    const totalPriceSums = document.querySelectorAll('#total-price-sum');
    
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    countLabels.forEach(label => label.textContent = totalQty);

    if (cart.length === 0) {
        lists.forEach(list => list.innerHTML = '<p style="color: #666; text-align: center; padding: 40px 20px;">Корзина пока пуста...</p>');
        totalBlocks.forEach(block => block.style.display = 'none');
        return;
    }
    
    totalBlocks.forEach(block => block.style.display = 'block');
    
    let total = 0;
    let htmlContent = '';

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const imgSrc = `./img/${item.img}`;

        htmlContent += `
            <div class="cart-item-row">
                <div class="cart-item-content">
                    <div class="cart-item-img-container"><img src="${imgSrc}" alt="${item.title}"></div>
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-info-line">${item.quantity} шт. x ${item.price.toLocaleString()} ₴</div>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${index})">&times;</button>
            </div>`;
    });

    lists.forEach(list => list.innerHTML = htmlContent);
    totalPriceSums.forEach(sum => sum.textContent = total.toLocaleString() + ' ₴');
}

function removeFromCart(index) {
    cart = JSON.parse(localStorage.getItem('watermar_cart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('watermar_cart', JSON.stringify(cart));
    updateCartUI();
}

function checkoutCart() {
    if (cart.length === 0) return;
    openModal('cart_checkout');
}

// ==========================================
// 5. МОДАЛКИ И КАТАЛОГ
// ==========================================
function openModal(type) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const serviceNames = { 'master': 'Вызов мастера', 'analysis': 'Анализ воды', 'call': 'Заказать звонок', 'cart_checkout': 'Оформление заказа' };
    
    if (title) title.textContent = serviceNames[type] || 'Заявка';
    const form = document.getElementById('order-form');
    if (form) form.dataset.service = type;
    
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function openProductModal(id) {
    const product = productsData[id];
    const content = document.getElementById('product-detail-content');
    const overlay = document.getElementById('product-modal-overlay');

    if (content && product) {
        window.currentQuantity = 1;
        content.classList.add('product-mode');
        content.innerHTML = `
            <div class="modal-image-container">
                <img src="./img/${product.img}" alt="${product.title}" class="modal-top-img">
            </div>
            <div class="modal-text-section">
                <h2 class="modal-title">${product.title}</h2>
                <p class="modal-subtitle">${product.desc}</p>
                <div class="price-large" style="margin-top: 10px;">${product.price.toLocaleString()} ₴</div>
                <button class="btn-add-cart" style="width: 100%; margin-top: 15px;" onclick="addToCart('${id}')">
                    Добавить в корзину
                </button>
            </div>`;
        overlay?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeProductModal() {
    document.getElementById('product-modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        closeModal();
        closeProductModal();
        closeCart();
        closeSideMenu();
        closeOrders();
    }
});

function openCatalog() {
    const home = document.getElementById('home-page');
    const catalog = document.getElementById('full-catalog-page');
    if (home && catalog) {
        home.style.display = 'none';
        catalog.style.display = 'block';
        window.scrollTo(0, 0);
        filterCatalog('all');
        updateCartUI(); // Синхронизируем корзину при входе
    }
}

function closeCatalog() {
    const home = document.getElementById('home-page');
    const catalog = document.getElementById('full-catalog-page');
    if (home && catalog) {
        catalog.style.display = 'none';
        home.style.display = 'block';
        updateCartUI(); // Синхронизируем корзину при выходе
    }
}

function filterCatalog(category = 'all') {
    const grid = document.getElementById('full-catalog-grid');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    Object.keys(productsData).forEach(id => {
        const product = productsData[id];
        grid.innerHTML += `
            <div class="product-card" onclick="openProductModal('${id}')">
                <div class="product-img-wrapper"><img src="./img/${product.img}" alt="${product.title}"></div>
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

// ==========================================
// 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
function showSuccessToast(title, desc, isError = false) {
    const toast = document.getElementById('toast');
    if (toast) {
        const tTitle = toast.querySelector('.toast-title');
        const tDesc = toast.querySelector('.toast-desc');
        if (tTitle) tTitle.textContent = title;
        if (tDesc) tDesc.textContent = desc;
        isError ? toast.classList.add('error') : toast.classList.remove('error');
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 4000);
    }
}

function openSideMenu() { document.getElementById('side-menu-overlay')?.classList.add('active'); }
function closeSideMenu() { document.getElementById('side-menu-overlay')?.classList.remove('active'); }

function showOrders() {
    closeSideMenu();
    document.getElementById('orders-overlay')?.classList.add('active');
    renderOrdersList();
}

function closeOrders() { document.getElementById('orders-overlay')?.classList.remove('active'); }

function renderOrdersList() {
    const list = document.getElementById('orders-list');
    const history = JSON.parse(localStorage.getItem('user_orders') || '[]');
    if (!list) return;
    list.innerHTML = history.length > 0 
        ? history.map(o => `<div class="order-card"><small>${o.date}</small><div>${o.item}</div><strong>${o.price}</strong></div>`).join('')
        : '<p style="text-align:center; opacity:0.3; margin-top:40px;">История пуста</p>';
}

function manageChatButton() {
    const chatBtn = document.getElementById('saber-chat-container');
    if (!chatBtn) return;
    const cycle = () => {
        chatBtn.classList.add('visible');
        setTimeout(() => {
            chatBtn.classList.remove('visible');
        }, 30000);
    };
    cycle();
    setInterval(cycle, 90000);
} 