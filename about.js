// about.js

// Функция для открытия бокового меню
function openSideMenu() {
    const menu = document.getElementById('side-menu-overlay');
    if (menu) {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden'; // Запрещаем скролл, когда меню открыто
        console.log("Меню 'О нас' открыто");
    }
}

// Функция для закрытия бокового меню
function closeSideMenu() {
    const menu = document.getElementById('side-menu-overlay');
    if (menu) {
        menu.classList.remove('active');
        document.body.style.overflow = ''; // Возвращаем скролл
        console.log("Меню 'О нас' закрыто");
    }
}

function setupPhoneCopying() {
    const phoneButtons = document.querySelectorAll('.contact-btn');

    phoneButtons.forEach(button => {
        // Проверяем, что это именно кнопка с номером (содержит цифры)
        if (/\d/.test(button.innerText)) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Очищаем номер от лишних символов для буфера, если нужно
                const phoneNumber = this.innerText.trim();
                
                navigator.clipboard.writeText(phoneNumber).then(() => {
                    const originalText = this.innerHTML;
                    
                    // Визуальный отклик
                    this.innerText = 'Номер скопирован!';
                    this.style.background = 'linear-gradient(135deg, #28a745, #218838)';
                    
                    setTimeout(() => {
                        this.innerHTML = originalText;
                        this.style.background = ''; // Возвращаем стиль из CSS
                    }, 2000);
                }).catch(err => {
                    console.error('Ошибка копирования:', err);
                });
            });
        }
    });
}

// Запускаем инициализацию после загрузки контента
document.addEventListener('DOMContentLoaded', () => {
    setupPhoneCopying();
    
    // Закрытие меню при клике на оверлей (бонус для удобства)
    const overlay = document.getElementById('side-menu-overlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) closeSideMenu();
        });
    }
});

// КНОПКА ПОМОЩИ ( ЧАТ )

function manageChatButton() {
    const chatBtn = document.getElementById('saber-chat-container');
    
    if (!chatBtn) return;

    function showButton() {
        chatBtn.classList.add('visible'); // Показываем
        
        // Через 30 секунд убираем
        setTimeout(() => {
            chatBtn.classList.remove('visible');
            
            // Через 60 секунд (итого 90 от старта) запускаем цикл заново
            setTimeout(showButton, 60000); 
        }, 30000);
    }

    // Первый запуск через 5 секунд после загрузки, чтобы не пугать сразу
    setTimeout(showButton, 5000);
}

// Запускаем менеджер после загрузки страницы
document.addEventListener('DOMContentLoaded', manageChatButton);