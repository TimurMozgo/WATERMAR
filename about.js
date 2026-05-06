// Анимация появления элементов при скролле (если оставил класс reveal)
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    });

    document.querySelectorAll('.feature-card').forEach(el => {
        el.classList.add('reveal'); // Добавляем класс программно
        observer.observe(el);
    });
});

/**
 * Управление мобильным меню
 */
function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    const body = document.body;

    if (!menu) return;

    // Переключаем класс active для открытия/закрытия
    menu.classList.toggle('active');

    // Если меню открыто — запрещаем скролл основной страницы
    if (menu.classList.contains('active')) {
        body.style.overflow = 'hidden';
    } else {
        body.style.overflow = 'auto';
    }
}

/**
 * Инициализация при загрузке страницы
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализируем иконки Lucide (чтобы бургер и крестик появились)
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 2. Закрытие меню при клике на ссылку (важно для переходов)
    const mobileLinks = document.querySelectorAll('.mobile-link');
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            const menu = document.getElementById('mobile-menu');
            if (menu.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    // 3. Закрытие меню клавишей Esc (для удобства)
    document.addEventListener('keydown', (e) => {
        const menu = document.getElementById('mobile-menu');
        if (e.key === 'Escape' && menu.classList.contains('active')) {
            toggleMenu();
        }
    });
});