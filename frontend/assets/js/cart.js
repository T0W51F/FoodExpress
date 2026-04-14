const cart = {
    cartItems: document.getElementById('cart-items'),
    cartEmpty: document.getElementById('cart-empty'),
    subtotal: document.getElementById('subtotal'),
    deliveryFee: document.getElementById('delivery-fee'),
    tax: document.getElementById('tax'),
    total: document.getElementById('total'),
    promoCode: document.getElementById('promo-code'),
    applyPromo: document.getElementById('apply-promo'),
    deliveryTime: document.getElementById('delivery-time')
};

document.addEventListener('DOMContentLoaded', function() {
    if (!cart.cartItems || !cart.cartEmpty) {
        return;
    }
    loadCartItems();
    initPromoCode();
});

function formatCurrency(value) {
    return `${Number(value || 0).toFixed(2)}Tk`;
}

function loadCartItems() {
    if (!cart.cartItems || !cart.cartEmpty) {
        return;
    }

    const cartData = JSON.parse(localStorage.getItem('cart') || '[]');

    if (cartData.length === 0) {
        cart.cartItems.innerHTML = '';
        cart.cartEmpty.style.display = 'block';
        updateOrderSummary(cartData);
        return;
    }

    cart.cartEmpty.style.display = 'none';

    const itemsByRestaurant = groupByRestaurant(cartData);
    const totalQuantity = cartData.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const subtotal = cartData.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

    let html = createCartInsightsHTML(totalQuantity, itemsByRestaurant.length, subtotal);

    itemsByRestaurant.forEach(({ restaurant, items }) => {
        html += createRestaurantSectionHTML(restaurant, items);
    });

    cart.cartItems.innerHTML = html;
    addCartItemEventListeners();
    updateOrderSummary(cartData);
}

function createCartInsightsHTML(totalQuantity, restaurantCount, subtotal) {
    return `
        <div class="cart-insights">
            <div class="cart-insight">
                <span>Items In Cart</span>
                <strong>${totalQuantity}</strong>
            </div>
            <div class="cart-insight">
                <span>Restaurant Groups</span>
                <strong>${restaurantCount}</strong>
            </div>
            <div class="cart-insight">
                <span>Current Subtotal</span>
                <strong>${formatCurrency(subtotal)}</strong>
            </div>
        </div>
    `;
}

function groupByRestaurant(cartData) {
    const groups = {};

    cartData.forEach(item => {
        const restaurant = item.restaurant || {
            id: 'unknown',
            name: 'FoodExpress Kitchen',
            image: item.image || 'default-food.jpg',
            cuisine: 'Fresh Picks',
            delivery_time: '25-35 min'
        };

        const restaurantId = restaurant.id || restaurant.name;
        if (!groups[restaurantId]) {
            groups[restaurantId] = {
                restaurant,
                items: []
            };
        }

        groups[restaurantId].items.push(item);
    });

    return Object.values(groups);
}

function createRestaurantSectionHTML(restaurant, items) {
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const restaurantSubtotal = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const restaurantImage = restaurant.image || items[0]?.image || 'default-food.jpg';
    const cuisine = restaurant.cuisine || restaurant.cuisine_type || 'Curated menu';
    const deliveryTime = restaurant.delivery_time || '25-35 min';

    return `
        <div class="restaurant-section">
            <div class="restaurant-section-header">
                <div class="restaurant-header">
                    <img src="../assets/images/foods/${restaurantImage}" alt="${restaurant.name}">
                    <div>
                        <h3>${restaurant.name}</h3>
                        <p>${cuisine} � ${deliveryTime}</p>
                    </div>
                </div>
                <div class="restaurant-meta">
                    <span>${itemCount} item${itemCount === 1 ? '' : 's'} ready</span>
                    <strong>${formatCurrency(restaurantSubtotal)}</strong>
                </div>
            </div>
            ${items.map(item => createCartItemHTML(item)).join('')}
        </div>
    `;
}

function createCartItemHTML(item) {
    const addonsHTML = item.addons && item.addons.length > 0
        ? `<div class="cart-item-addons">Add-ons: ${item.addons.map(addon => addon.name).join(', ')}</div>`
        : '<div class="cart-item-note">No add-ons selected</div>';

    const instructionsHTML = item.instructions
        ? `<div class="cart-item-instructions"><small>Note: ${item.instructions}</small></div>`
        : '';

    const unitPrice = Number(item.price || 0) + (item.addons?.reduce((sum, addon) => sum + Number(addon.price || 0), 0) || 0);

    return `
        <div class="cart-item" data-id="${item.id}" data-addons="${encodeURIComponent(JSON.stringify(item.addons || []))}">
            <div class="cart-item-image">
                <img src="../assets/images/foods/${item.image}" alt="${item.name}">
            </div>
            <div class="cart-item-info">
                <div class="cart-item-topline">
                    <div>
                        <h4>${item.name}</h4>
                        <p>${item.description || 'Prepared fresh for your order.'}</p>
                    </div>
                    <span class="cart-item-unit-price">${formatCurrency(unitPrice)} each</span>
                </div>
                <div class="cart-item-meta">
                    ${addonsHTML}
                    ${instructionsHTML}
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn decrease" type="button">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn increase" type="button">+</button>
                    <button class="cart-item-remove" type="button">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
            <div class="cart-item-price">
                ${formatCurrency(item.totalPrice)}
            </div>
        </div>
    `;
}

function getCartItemAddons(cartItemElement) {
    return JSON.parse(decodeURIComponent(cartItemElement.dataset.addons || '%5B%5D'));
}

function addCartItemEventListeners() {
    document.querySelectorAll('.cart-item .decrease').forEach(btn => {
        btn.addEventListener('click', function() {
            const cartItem = this.closest('.cart-item');
            const itemId = cartItem.dataset.id;
            const addons = getCartItemAddons(cartItem);
            updateCartItemQuantity(itemId, addons, -1);
        });
    });

    document.querySelectorAll('.cart-item .increase').forEach(btn => {
        btn.addEventListener('click', function() {
            const cartItem = this.closest('.cart-item');
            const itemId = cartItem.dataset.id;
            const addons = getCartItemAddons(cartItem);
            updateCartItemQuantity(itemId, addons, 1);
        });
    });

    document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const cartItem = this.closest('.cart-item');
            const itemId = cartItem.dataset.id;
            const addons = getCartItemAddons(cartItem);
            removeCartItem(itemId, addons);
        });
    });
}

function updateCartItemQuantity(itemId, addons, change) {
    let cartData = JSON.parse(localStorage.getItem('cart') || '[]');

    const itemIndex = cartData.findIndex(item =>
        item.id == itemId && JSON.stringify(item.addons || []) === JSON.stringify(addons || [])
    );

    if (itemIndex === -1) {
        return;
    }

    const item = cartData[itemIndex];
    const newQuantity = Number(item.quantity || 0) + change;

    if (newQuantity < 1) {
        cartData.splice(itemIndex, 1);
    } else if (newQuantity > 20) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Maximum quantity is 20', 'warning');
        }
        return;
    } else {
        const addonTotal = (item.addons?.reduce((sum, addon) => sum + Number(addon.price || 0), 0) || 0);
        cartData[itemIndex].quantity = newQuantity;
        cartData[itemIndex].totalPrice = (Number(item.price || 0) + addonTotal) * newQuantity;
    }

    localStorage.setItem('cart', JSON.stringify(cartData));
    loadCartItems();
    updateCartCount();

    if (typeof window.showNotification === 'function') {
        window.showNotification('Cart updated', 'success');
    }
}

function removeCartItem(itemId, addons) {
    let cartData = JSON.parse(localStorage.getItem('cart') || '[]');

    const newCart = cartData.filter(item =>
        !(item.id == itemId && JSON.stringify(item.addons || []) === JSON.stringify(addons || []))
    );

    localStorage.setItem('cart', JSON.stringify(newCart));
    loadCartItems();
    updateCartCount();

    if (typeof window.showNotification === 'function') {
        window.showNotification('Item removed from cart', 'success');
    }
}

function updateOrderSummary(cartData) {
    const subtotal = cartData.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const deliveryFee = subtotal > 20 ? 0 : (subtotal > 0 ? 2.99 : 0);
    const tax = subtotal * 0.085;
    const total = subtotal + deliveryFee + tax;

    let fastestDelivery = '25-35 min';
    if (cartData.length > 0 && cartData[0].restaurant) {
        fastestDelivery = cartData[0].restaurant.delivery_time || fastestDelivery;
    }

    cart.subtotal.textContent = formatCurrency(subtotal);
    cart.deliveryFee.textContent = deliveryFee === 0 && subtotal > 0 ? 'FREE' : formatCurrency(deliveryFee);
    cart.tax.textContent = formatCurrency(tax);
    cart.total.textContent = formatCurrency(total);
    cart.deliveryTime.textContent = fastestDelivery;

    const mobileCartTotal = document.getElementById('mobile-cart-total');
    if (mobileCartTotal) {
        mobileCartTotal.textContent = formatCurrency(total);
    }
}

function initPromoCode() {
    if (!cart.applyPromo || !cart.promoCode) {
        return;
    }

    cart.applyPromo.addEventListener('click', async function() {
        const code = cart.promoCode.value.trim().toUpperCase();

        if (!code) {
            if (typeof window.showNotification === 'function') {
                window.showNotification('Please enter a promo code', 'error');
            }
            return;
        }

        const cartData = JSON.parse(localStorage.getItem('cart') || '[]');
        const subtotal = cartData.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

        cart.applyPromo.disabled = true;
        cart.applyPromo.textContent = 'Checking...';

        try {
            const BASE_URL = window.API?.config?.BASE_URL || 'http://localhost:5000/api';
            const response = await fetch(`${BASE_URL}/orders/promotions/validate/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ code, subtotal })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Invalid promo code');
            }
            applyPromoCode(data.code, data.discount_amount, data.discount_type, data.title);
        } catch (error) {
            if (typeof window.showNotification === 'function') {
                window.showNotification(error.message || 'Invalid promo code', 'error');
            }
            cart.applyPromo.disabled = false;
            cart.applyPromo.textContent = 'Apply';
        }
    });

    cart.promoCode.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            cart.applyPromo.click();
        }
    });
}

function applyPromoCode(code, discountAmount, discountType, title) {
    const cartData = JSON.parse(localStorage.getItem('cart') || '[]');

    if (cartData.length === 0) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Your cart is empty', 'error');
        }
        return;
    }

    const appliedPromos = JSON.parse(localStorage.getItem('appliedPromos') || '[]');
    if (appliedPromos.includes(code)) {
        if (typeof window.showNotification === 'function') {
            window.showNotification('Promo code already applied', 'warning');
        }
        return;
    }

    const discountText = title || (discountType === 'percentage' ? `Discount (${code}) Applied` : `Tk ${discountAmount} Off Applied`);

    const summaryDetails = document.querySelector('.summary-details');
    if (!summaryDetails.querySelector(`[data-promo-code="${code}"]`)) {
        const discountRow = document.createElement('div');
        discountRow.className = 'summary-row';
        discountRow.dataset.promoCode = code;
        discountRow.innerHTML = `
            <span>Discount (${code})</span>
            <span style="color: var(--success-color);">-${formatCurrency(discountAmount).replace('Tk ', 'Tk ')}</span>
        `;
        const totalRow = summaryDetails.querySelector('.total');
        summaryDetails.insertBefore(discountRow, totalRow);
    }

    const currentTotal = parseFloat((cart.total.textContent || 'Tk 0').replace('Tk ', ''));
    const newTotal = Math.max(0, currentTotal - discountAmount);
    cart.total.textContent = formatCurrency(newTotal);

    cart.promoCode.disabled = true;
    cart.applyPromo.disabled = true;
    cart.applyPromo.textContent = 'Applied';

    appliedPromos.push(code);
    localStorage.setItem('appliedPromos', JSON.stringify(appliedPromos));

    if (typeof window.showNotification === 'function') {
        window.showNotification(discountText, 'success');
    }
}

function clearAppliedPromos() {
    localStorage.removeItem('appliedPromos');
}

function updateCartCount() {
    const cartData = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cartData.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = totalItems;
    });

    const mobileCartCount = document.getElementById('mobile-cart-count');
    if (mobileCartCount) {
        mobileCartCount.textContent = totalItems;
    }

    if (totalItems === 0) {
        clearAppliedPromos();
    }
}
