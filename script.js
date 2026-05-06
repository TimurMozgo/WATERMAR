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

function addToCart(name, price) {
    cart.push({ name, price });
    saveAndRefresh();
    
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
    const countEl = document.getElementById('cart-count');
    const listEl = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total');
    
    if (countEl) countEl.innerText = cart.length;
    if (!listEl) return;
    
    listEl.innerHTML = '';
    let totalSum = 0;
    
    if (cart.length === 0) {
        listEl.innerHTML = '<p class="empty-msg" style="text-align:center; opacity:0.5; margin-top:50px;">В корзине пока пусто</p>';
    } else {
        cart.forEach((item, index) => {
            totalSum += item.price;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div style="flex-grow: 1;">
                    <div style="font-weight:600; font-size: 15px; color: #fff;">${item.name}</div>
                    <div style="font-size:13px; color:#8b5cf6">${item.price.toLocaleString()} ₴</div>
                </div>
                <button class="remove-btn" onclick="removeItem(${index})">&times;</button>
            `;
            listEl.appendChild(itemDiv);
        });
    }
    
    if (totalEl) totalEl.innerText = totalSum.toLocaleString();
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
// Конфиг для категорий, чтобы не плодить HTML
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