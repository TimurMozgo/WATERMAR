// ==========================================
// КАТАЛОГ: ЗАГРУЗКА ДАННЫХ И ОТРИСОВКА (PRO ВЕРСИЯ)
// ==========================================

const API_URL = 'https://tiktiok.xyz/webhook/997f03bf-9029-4117-935b-d9cfedfd92e6';
let allProducts = []; 

// ИСПОЛЬЗУЕМ УНИКАЛЬНЫЙ КЛЮЧ ДЛЯ КАТАЛОГА
let cart = JSON.parse(localStorage.getItem('watermar_catalog_cart')) || []; 

let currentQuantity = 1; 

function getProductImage(product) {
    if (product.photo && product.photo.includes('http')) return product.photo;
    if (product.img && product.img.includes('http')) return product.img;
    
    const name = String(product.name || product.title).toLowerCase();
    if (name.includes('5-50')) return './img/1.png';
    if (name.includes('6-50 p') && !name.includes('perla')) return './img/2.png';
    if (name.includes('la perla')) return './img/3.png';

    return product.photo || product.img || 'https://via.placeholder.com/300x300?text=Нет+фото';
}

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
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1; padding:40px; color:#666;">Товаров пока нет в этой категории.</p>`;
        return;
    }

    filtered.forEach(product => {
        const productImage = getProductImage(product);

        grid.innerHTML += `
            <div class="product-card" id="card-${product.id}" onclick="prepareAddToCart('${product.id}')">
                <div class="product-image">
                    <img src="${productImage}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/300x300?text=Ошибка+загрузки'">
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

function prepareAddToCart(productId) {
    let product = allProducts.find(p => String(p.id) === String(productId));

    if (!product) {
        const card = document.querySelector(`[onclick*="'${productId}'"]`) || event.currentTarget;
        if (card) {
            product = {
                id: productId,
                name: card.querySelector('.product-title')?.innerText || 'Товар',
                price: parseFloat(card.querySelector('.price')?.innerText.replace(/[^\d.]/g, '')) || 0,
                photo: card.querySelector('img')?.src || ''
            };
        }
    }

    if (!product) return;

    currentQuantity = 1; 
    const overlay = document.getElementById('product-confirm-overlay');
    const modalBody = document.getElementById('confirm-modal-body');

    if (overlay && modalBody) {
        const productImage = getProductImage(product);

        modalBody.innerHTML = `
            <img src="${productImage}" class="confirm-modal-img full-width" onerror="this.src='https://via.placeholder.com/400x300?text=Ошибка+загрузки'">
            <div class="confirm-modal-info-padding">
                <h2 class="confirm-modal-title" data-id="${product.id}">${product.name}</h2>
                <p class="confirm-modal-desc">${product.description || 'Идеальное решение для вашей системы водоснабжения.'}</p>
                
                <div class="modal-qty-container" style="display: flex; align-items: center; justify-content: center; gap: 20px; margin: 20px 0;">
                    <button onclick="updateModalQty(-1)" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: none; color: white; font-size: 20px; cursor: pointer;">−</button>
                    <span id="modal-qty-display" style="font-size: 22px; font-weight: bold; min-width: 30px; text-align: center;">1</span>
                    <button onclick="updateModalQty(1)" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); background: none; color: white; font-size: 20px; cursor: pointer;">+</button>
                </div>

                <div class="confirm-modal-price-bottom" 
                     id="modal-total-price" 
                     data-base-price="${product.price}">
                     ${product.price.toLocaleString()} ₴
                </div>
                
                <button class="btn-confirm-final" onclick="executeAddToCart('${product.id}')">Добавить в корзину</button>
            </div>`;
        
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    }
}

function updateModalQty(delta) {
    const display = document.getElementById('modal-qty-display');
    const priceDisplay = document.getElementById('modal-total-price');
    const basePrice = parseFloat(priceDisplay.dataset.basePrice);

    currentQuantity += delta;
    if (currentQuantity < 1) currentQuantity = 1;

    if (display) display.innerText = currentQuantity;
    if (priceDisplay) {
        const total = basePrice * currentQuantity;
        priceDisplay.innerText = `${total.toLocaleString()} ₴`;
    }
}

function closeConfirmModal() {
    const overlay = document.getElementById('product-confirm-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function executeAddToCart(productId) {
    let product = allProducts.find(p => String(p.id) === String(productId));
    
    // Если товара нет в API списке (например, ручное добавление), создаем объект из модалки
    if (!product) {
        product = {
            id: productId,
            name: document.querySelector('.confirm-modal-title').innerText,
            price: parseFloat(document.getElementById('modal-total-price').dataset.basePrice)
        };
    }

    const existingItem = cart.find(item => String(item.id) === String(product.id));

    if (existingItem) {
        existingItem.quantity += currentQuantity;
    } else {
        const itemToAdd = { 
            id: product.id,
            title: product.name, 
            price: Number(product.price),
            img: getProductImage(product), 
            quantity: currentQuantity 
        };
        cart.push(itemToAdd);
    }
    
    localStorage.setItem('watermar_catalog_cart', JSON.stringify(cart));
    updateCartUI();
    showToast(`${product.name} x${currentQuantity}`);
    closeConfirmModal();
}

function updateTabsUI(category) {
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('onclick')?.includes(`'${category}'`)) {
            tab.classList.add('active');
        }
    });
}

function updateCartUI() {
    const cartList = document.getElementById('cart-items-list');
    const cartCount = document.querySelector('.cart-count');
    const cartTotal = document.getElementById('cart-total');

    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    if (cartCount) cartCount.innerText = totalItems;

    if (cartList) {
        let htmlContent = '';
        if (cart.length === 0) {
            htmlContent = '<p class="empty-msg" style="text-align:center; color:rgba(255,255,255,0.3); padding:40px; font-size: 14px;">В корзине пока пусто</p>';
        } else {
            htmlContent = cart.map((item, index) => {
                return `
                <div class="cart-item" id="cart-item-${index}" style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 10px; margin-bottom: 10px;">
                    <img src="${item.img}" class="cart-item-img" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; background: #1a1d26;">
                    
                    <div class="cart-item-info" style="flex-grow: 1;">
                        <h4 style="margin: 0 0 6px 0; font-size: 13px; color: white; font-weight: 500;">${item.title}</h4>
                        
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <!-- Счётчик -->
                            <div style="display: flex; align-items: center; background: rgba(255,255,255,0.08); border-radius: 8px; padding: 2px;">
                                <button onclick="changeQtyInCart(${index}, -1)" style="width: 24px; height: 24px; border: none; background: none; color: white; cursor: pointer; font-size: 16px;">−</button>
                                <span style="font-size: 13px; font-weight: 600; min-width: 20px; text-align: center; color: white;">${item.quantity}</span>
                                <button onclick="changeQtyInCart(${index}, 1)" style="width: 24px; height: 24px; border: none; background: none; color: white; cursor: pointer; font-size: 16px;">+</button>
                            </div>
                            
                            <p style="margin: 0; color: #46a1df; font-weight: 700; font-size: 14px;">${(item.price * item.quantity).toLocaleString()} ₴</p>
                        </div>
                    </div>

                    <!-- Удаление -->
                    <button onclick="animateRemoveFromCart(${index})" style="background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: rgba(255,255,255,0.4); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px;">
                        &times;
                    </button>
                </div>`;
            }).join('');
        }
        cartList.innerHTML = htmlContent;
    }

    const total = cart.reduce((sum, item) => sum + (Number(item.price) * (item.quantity || 1)), 0);
    if (cartTotal) cartTotal.innerText = `${total.toLocaleString()} ₴`;
}

function changeQtyInCart(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        animateRemoveFromCart(index);
    } else {
        localStorage.setItem('watermar_catalog_cart', JSON.stringify(cart));
        updateCartUI();
    }
}

function animateRemoveFromCart(index) {
    const itemElement = document.getElementById(`cart-item-${index}`);
    if (itemElement) {
        itemElement.style.opacity = '0';
        itemElement.style.transform = 'translateX(50px)';
        setTimeout(() => removeFromCart(index), 400);
    } else {
        removeFromCart(index);
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('watermar_catalog_cart', JSON.stringify(cart));
    updateCartUI();
}

function openCart() {
    document.getElementById('cart-modal-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cart-modal-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function openCheckout() {
    if (cart.length === 0) return;
    document.getElementById('checkout-overlay')?.classList.add('active');
}

function closeCheckout() {
    document.getElementById('checkout-overlay')?.classList.remove('active');
}

async function sendOrderToN8N() {
    const name = document.getElementById('user-name').value;
    const phone = document.getElementById('user-phone').value;
    const ORDER_API_URL = 'https://tiktiok.xyz/webhook/708aaac4-0733-4a46-ad0c-f919e3c08698';

    if (!name || !phone) return;

    const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) * (item.quantity || 1)), 0);
    
    const orderData = {
        customer_name: name,
        customer_phone: Number(phone),
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
            // Сохраняем в историю
            const history = JSON.parse(localStorage.getItem('user_orders') || '[]');
            history.unshift({
                date: new Date().toLocaleDateString('uk-UA'),
                item: cart.map(i => `${i.title} (${i.quantity} шт.)`).join(', '),
                price: totalPrice.toLocaleString() + ' ₴'
            });
            localStorage.setItem('user_orders', JSON.stringify(history));

            cart = []; 
            localStorage.removeItem('watermar_catalog_cart'); 
            updateCartUI();
            closeCheckout();
            closeCart();
        }
    } catch (e) { console.error(e); }
}

function showToast(productName) {
    const toast = document.getElementById('toast-added');
    const toastNameSpan = document.getElementById('toast-product-name');
    if (toast && toastNameSpan) {
        toastNameSpan.innerText = productName;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    updateCartUI();
});