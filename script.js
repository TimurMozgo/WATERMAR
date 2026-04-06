// 1. НАСТРОЙКИ И ДАННЫЕ
const WEBHOOK_URL = 'https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698';

const productsData = {
    'osmosis': { title: 'Обратный осмос RO-6', price: '8 500 ₴', desc: 'Профессиональная система очистки. Удаляет 99% примесей.', img: 'filter1.png' },
    'softener': { title: 'Умягчитель Cabinet', price: '14 200 ₴', desc: 'Идеальное решение для квартир. Защищает от накипи.', img: 'filter2.png' },
    'column': { title: 'Колонна 1054', price: '21 000 ₴', desc: 'Мощная система для частного дома. Ресурс до 5 лет.', img: 'filter3.png' }
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

        // Сбор данных из корзины
        let totalSum = 0;
        const productsList = cart.map((item, index) => {
            const priceNum = parseInt(item.price.replace(/\s/g, '')) || 0;
            totalSum += priceNum;
            return `${index + 1}. ${item.title}`;
        }).join('\n');

        // Словарь категорий для четкого понимания в n8n
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
            // Если корзина пуста, в поле "Товары" пишем название самой услуги
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

    // Анимации появления элементов
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
        if (list) list.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Корзина пока пуста...</p>';
        if (totalBlock) totalBlock.style.display = 'none';
        return;
    }
    
    if (totalBlock) totalBlock.style.display = 'block';
    if (list) {
        list.innerHTML = '';
        let total = 0;
        cart.forEach((item, index) => {
            total += parseInt(item.price.replace(/\s/g, '')) || 0;
            list.innerHTML += `
                <div class="cart-item" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #333;">
                    <div>
                        <div style="font-weight: bold; color: #fff;">${item.title}</div>
                        <div style="color: #46a1df;">${item.price}</div>
                    </div>
                    <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #ff4d4d; cursor: pointer;">Удалить</button>
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
    const serviceNames = { 
        'master': 'Вызов мастера', 
        'analysis': 'Анализ воды', 
        'call': 'Заказать звонок', 
        'cart_checkout': 'Оформление заказа' 
    };
    
    if (title) title.textContent = serviceNames[type] || 'Заявка';
    document.getElementById('order-form').dataset.service = type;
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
        content.innerHTML = `
            <img src="${product.img}" style="width: 100%; border-radius: 15px; margin-bottom: 15px;">
            <h2>${product.title}</h2>
            <div style="color: #46a1df; font-size: 20px; font-weight: 800; margin: 10px 0;">${product.price}</div>
            <p style="color: #888; font-size: 14px;">${product.desc}</p>
            <button class="btn-submit" style="width: 100%; margin-top: 20px; padding: 15px; border-radius: 12px; background: #46a1df; color: #fff; border: none; font-weight: bold; cursor: pointer;" onclick="addToCart('${id}')">Добавить в корзину</button>
        `;
        overlay?.classList.add('active');
    }
}

function closeProductModal() {
    document.getElementById('product-modal-overlay')?.classList.remove('active');
}

// 6. УВЕДОМЛЕНИЯ
function showSuccessToast(title, desc, isError = false) {
    const toast = document.getElementById('toast');
    const tTitle = document.querySelector('.toast-title');
    const tDesc = document.querySelector('.toast-desc');
    const tIcon = document.querySelector('.toast-icon');
    
    if (toast && tTitle && tDesc && tIcon) {
        tTitle.textContent = title;
        tDesc.textContent = desc;
        
        if (isError) {
            toast.classList.add('error');
            tIcon.textContent = ''; 
        } else {
            toast.classList.remove('error');
            tIcon.textContent = '✓'; 
        }
        
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 4000);
    }
}