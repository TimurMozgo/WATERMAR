// === 1. АНИМАЦИЯ ПОЯВЛЕНИЯ ПРИ СКРОЛЛЕ ===
const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        } else {
            if (entry.boundingClientRect.top > 0) {
                entry.target.classList.remove('active');
            }
        }
    });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// === 2. ЛОГИКА КОРЗИНЫ (БИЗНЕС-ЛОГИКА) ===
let cart = JSON.parse(localStorage.getItem('aqua_cart')) || [];

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');

    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

// === 3. БУРГЕРНОЕ МЕНЮ ===

function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    const body = document.body;
    
    menu.classList.toggle('active');
    
    // Блокируем скролл основной страницы при открытом меню
    if (menu.classList.contains('active')) {
        body.style.overflow = 'hidden';
    } else {
        body.style.overflow = 'auto';
    }
    
    // Переинициализируем иконки Lucide внутри меню, если нужно
    lucide.createIcons();
}

function addToCart(name, price, photo) {
    const imgPath = photo || './img/1.png'; 
    
    // Ищем, есть ли уже такой товар в корзине
    const existingItem = cart.find(item => item.name === name);

    if (existingItem) {
        existingItem.count += 1; // Если есть — увеличиваем счетчик
    } else {
        // Если нет — добавляем новый объект с полем count: 1
        cart.push({ name, price, photo: imgPath, count: 1 }); 
    }
    
    saveAndRefresh();
    
    // Анимация бейджа
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.style.transform = 'scale(1.4)';
        setTimeout(() => badge.style.transform = 'scale(1)', 200);
    }
    showToast(name);
}

function removeItem(index) {
    cart.splice(index, 1);
    saveAndRefresh();
}

function saveAndRefresh() {
    localStorage.setItem('aqua_cart', JSON.stringify(cart));
    renderCart();
}

function renderCart() {
    const listEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    const countEl = document.getElementById('cart-count');
    
    // Считаем общее кол-во предметов (защита от NaN через || 0)
    const totalCount = cart.reduce((sum, item) => sum + (item.count || 1), 0);
    if (countEl) countEl.innerText = totalCount;

    if (!listEl) return;
    listEl.innerHTML = '';
    let totalSum = 0;
    
    if (cart.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; opacity:0.5; margin-top:50px;">Корзина пуста</p>';
    } else {
        cart.forEach((item, index) => {
            const count = item.count || 1; // Защита: если count нет, считаем как 1
            totalSum += item.price * count;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            
            itemDiv.innerHTML = `
                <img src="${item.photo}" class="cart-item-img">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${(item.price * count).toLocaleString()} ₴</div>
                    
                    <div class="quantity-controls">
                        <button class="qty-btn" onclick="updateQuantity(${index}, -1)">−</button>
                        <span class="qty-count">${count}</span>
                        <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-item-btn" onclick="updateQuantity(${index}, -${count})">&times;</button>
            `;
            listEl.appendChild(itemDiv);
        });
    }
    
    if (totalEl) totalEl.innerText = totalSum.toLocaleString();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateQuantity(index, delta) {
    cart[index].count += delta;
    
    // Если количество стало 0 — удаляем товар совсем
    if (cart[index].count <= 0) {
        cart.splice(index, 1);
    }
    
    saveAndRefresh();
}

function openOrderModal() {
    console.log("Пытаюсь открыть окно...");
    const modal = document.getElementById('order-modal');
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');

    if (modal) {
        // 1. Прячем корзину вручную и надежно
        if(sidebar) sidebar.classList.remove('active');
        if(overlay) overlay.classList.remove('active');
        document.body.style.overflow = ''; 

        // 2. Показываем модалку
        modal.style.display = 'block';
        console.log("Окно должно быть открыто");
    } else {
        alert("Ошибка: Не найден блок order-modal в HTML!");
    }
}

function closeOrderModal() {
    document.getElementById('order-modal').style.display = 'none';
}

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
    // Используем count, так как это имя поля в вашем текущем script.js
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

// Функция для быстрой заявки на услуги
function sendServiceRequest(serviceName) {
    const phone = prompt(`Укажите ваш номер телефона для услуги: ${serviceName}`);
    
    if (phone && phone.trim() !== "") {
        fetch('https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: "Service Request",
                service_type: serviceName,
                customer_phone: phone.trim(),
                timestamp: new Date().toISOString()
            })
        });
        alert("Заявка успешно отправлена. Наш специалист свяжется с вами.");
    }
}

// === 4. УВЕДОМЛЕНИЯ (TOAST) ===
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

// === 5. ДИНАМИЧЕСКИЕ МОДАЛЬНЫЕ ОКНА (УСЛУГИ) ===
const serviceData = {
    master: {
        title: "Вызов мастера",
        description: "Мастер приедет на объект для диагностики, замера или устранения неполадок. Все инструменты с собой.",
        btnText: "Вызвать мастера"
    },
    analysis: {
        title: "Анализ воды",
        description: "Проведем жесткую проверку воды по 12 показателям и подберем идеальную систему фильтрации.",
        btnText: "Записаться на анализ"
    },
    call: {
        title: "Заказать звонок",
        description: "Оставьте ваши контакты, и наш эксперт свяжется с вами в течение 15 минут.",
        btnText: "Жду звонка"
    }
};

function openServiceForm(type) {
    const data = serviceData[type];
    if (!data) return;

    // Заполняем модалку данными
    const titleEl = document.getElementById('modal-title');
    const descEl = document.getElementById('modal-description');
    const btnTextEl = document.getElementById('modal-btn-text');
    const overlay = document.getElementById('service-overlay');

    if (titleEl) titleEl.innerText = data.title;
    if (descEl) descEl.innerText = data.description;
    if (btnTextEl) btnTextEl.innerText = data.btnText;

    // --- ДОБАВЛЕННЫЙ БЛОК ДЛЯ n8n ---
    const requestForm = document.getElementById('request-form');
    if (requestForm) {
        // Убираем старые слушатели, чтобы заявки не дублировались
        const newForm = requestForm.cloneNode(true);
        requestForm.parentNode.replaceChild(newForm, requestForm);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('user-name').value;
            const phone = document.getElementById('user-phone').value;
            const service = titleEl ? titleEl.innerText : "Услуга не указана";
            const toast = document.getElementById('success-message');

            try {
                fetch('https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: "Service Request",
                        customer_name: name,
                        customer_phone: phone,
                        service_type: service,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (error) {
                console.error("Ошибка отправки формы:", error);
            }

            closeServiceForm();

            if (toast) {
                toast.classList.add('active');
                setTimeout(() => toast.classList.remove('active'), 3000);
            }
            
            newForm.reset();
        });
    }

    // Показываем с анимацией
    if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);
        document.body.style.overflow = 'hidden'; // Стопаем скролл
    }
}

function closeServiceForm() {
    const overlay = document.getElementById('service-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.style.display = 'none';
            document.body.style.overflow = ''; // Возвращаем скролл
        }, 300);
    }
}


// === ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ===
document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Слушатель для закрытия модалки по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeServiceForm();
            if (document.getElementById('cart-sidebar').classList.contains('active')) {
                toggleCart();
            }
        }
    });
});