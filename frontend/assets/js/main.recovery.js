// DOM Elements
const DOM = {
    menuToggle: document.querySelector('.menu-toggle'),
    navLinks: document.querySelector('.nav-links'),
    cartCounts: document.querySelectorAll('.cart-count'),
    mobileCartCount: document.getElementById('mobile-cart-count'),
    mobileCartTotal: document.getElementById('mobile-cart-total'),
    cartEmpty: document.getElementById('cart-empty'),
    cartItems: document.getElementById('cart-items'),
    checkoutBtn: document.getElementById('checkout-btn'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    loadMoreOrdersBtn: document.getElementById('load-more-orders'),
    restaurantSearch: document.getElementById('restaurant-search'),
    cuisineFilter: document.getElementById('cuisine-filter'),
    sortFilter: document.getElementById('sort-filter'),
    categoryTabs: document.getElementById('category-tabs'),
    restaurantsList: document.getElementById('restaurants-list'),
    ordersList: document.getElementById('orders-list'),
    noOrders: document.getElementById('no-orders'),
    noResults: document.getElementById('no-results'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    featuredRestaurants: document.getElementById('featured-restaurants'),
    popularFoods: document.getElementById('popular-foods'),
    restaurantHeader: document.getElementById('restaurant-header'),
    menuCategories: document.getElementById('menu-categories'),
    menuItems: document.getElementById('menu-items'),
    addToCartModal: document.getElementById('add-to-cart-modal'),
    checkoutModal: document.getElementById('checkout-modal'),
    verificationModal: document.getElementById('verification-modal'),
    userBtn: document.querySelector('.user-btn'),
    userDropdown: document.querySelector('.user-dropdown'),
    username: document.getElementById('username'),
    logoutBtn: document.getElementById('logout-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    initUserMenu();
    initModals();
    updateCartCount();
    checkLoginStatus();
});

// Mobile Menu Toggle
function initMobileMenu() {
    if (DOM.menuToggle && DOM.navLinks) {
        DOM.menuToggle.addEventListener('click', () => {
            DOM.navLinks.classList.toggle('show');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!DOM.navLinks.contains(e.target) && !DOM.menuToggle.contains(e.target)) {
                DOM.navLinks.classList.remove('show');
            }
        });
    }
}

// User Menu
function initUserMenu() {
    if (DOM.userBtn && DOM.userDropdown) {
        DOM.userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.userDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            DOM.userDropdown.classList.remove('show');
        });
        
        // Close dropdown when clicking inside
        DOM.userDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// Check Login Status
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (DOM.username) {
        DOM.username.textContent = user.firstName || 'Guest';
    }
    
    // Show/hide login/register buttons
    const authButtons = document.querySelectorAll('.auth-buttons');
    authButtons.forEach(btn => {
        if (isLoggedIn) {
            btn.innerHTML = `
                <div class="user-menu">
                    <button class="user-btn">
                        <i class="fas fa-user"></i>
                        <span>${user.firstName || 'User'}</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="user-dropdown">
                        <a href="orders.html"><i class="fas fa-history"></i> Order History</a>
                        <a href="#"><i class="fas fa-cog"></i> Settings</a>
                        <hr>
                        <a href="#" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a>
                    </div>
                </div>
            `;
        }
    });
}

// Update Cart Count
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Update all cart count elements
    DOM.cartCounts.forEach(el => {
        el.textContent = totalItems;
    });
    
    if (DOM.mobileCartCount) {
        DOM.mobileCartCount.textContent = totalItems;
    }
    
    // Update cart total
    updateCartTotal();
}

// Update Cart Total
function updateCartTotal() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (DOM.mobileCartTotal) {
        DOM.mobileCartTotal.textContent = `$${subtotal.toFixed(2)}`;
    }
}

// Load Featured Restaurants
async function loadFeaturedRestaurants() {
    try {
        const response = await fetch('../data/restaurants.json');
        const data = await response.json();
        const featured = data.restaurants.filter(r => r.featured).slice(0, 3);
        
        DOM.featuredRestaurants.innerHTML = featured.map(restaurant => `
            <div class="restaurant-card" data-id="${restaurant.id}">
                <div class="restaurant-image">
                    <img src="../assets/images/foods/${restaurant.image}" alt="${restaurant.name}">
                    ${restaurant.featured ? '<div class="restaurant-badge">Featured</div>' : ''}
                    ${!restaurant.is_open ? '<div class="restaurant-closed">Closed</div>' : ''}
                </div>
                <div class="restaurant-info">
                    <div class="restaurant-header">
                        <div>
                            <h3 class="restaurant-name">${restaurant.name}</h3>
                            <p class="restaurant-cuisine">${restaurant.cuisine}</p>
                        </div>
                        <div class="restaurant-rating">
                            <i class="fas fa-star"></i>
                            <span>${restaurant.rating}</span>
                        </div>
                    </div>
                    <div class="restaurant-details">
                        <div class="restaurant-detail">
                            <i class="fas fa-clock"></i>
                            <span>${restaurant.delivery_time}</span>
                        </div>
                        <div class="restaurant-detail">
                            <i class="fas fa-truck"></i>
                            <span>$${restaurant.delivery_fee}</span>
                        </div>
                        <div class="restaurant-detail">
                            <i class="fas fa-shopping-bag"></i>
                            <span>$${restaurant.min_order} min</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click event to restaurant cards
        document.querySelectorAll('.restaurant-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const id = card.dataset.id;
                window.location.href = `menu.html?restaurant_id=${id}`;
            });
        });
    } catch (error) {
        console.error('Error loading featured restaurants:', error);
        DOM.featuredRestaurants.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Unable to load restaurants</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// Load Popular Foods
async function loadPopularFoods() {
    try {
        const response = await fetch('../data/foods.json');
        const data = await response.json();
        const popular = data.foods.filter(f => f.popular).slice(0, 4);
        
        DOM.popularFoods.innerHTML = popular.map(food => `
            <div class="food-card" data-id="${food.id}">
                <div class="food-image">
                    <img src="../assets/images/foods/${food.image}" alt="${food.name}">
                </div>
                <div class="food-info">
                    <div class="food-header">
                        <h3 class="food-name">${food.name}</h3>
                        <div class="food-price">$${food.price}</div>
                    </div>
                    <p class="food-description">${food.description}</p>
                    <div class="food-tags">
                        ${food.vegetarian ? '<span class="food-tag vegetarian">Vegetarian</span>' : ''}
                        ${food.spicy_level > 0 ? '<span class="food-tag spicy">Spicy</span>' : ''}
                    </div>
                    <div class="food-rating">
                        <i class="fas fa-star"></i>
                        <span>${food.rating}</span>
                    </div>
                    <button class="btn btn-primary add-to-cart-btn">
                        <i class="fas fa-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click event to food cards
        document.querySelectorAll('.food-card .add-to-cart-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const food = popular[index];
                showAddToCartModal(food);
            });
        });
        
        // Add click event to food cards
        document.querySelectorAll('.food-card').forEach((card, index) => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.add-to-cart-btn')) {
                    const food = popular[index];
                    showAddToCartModal(food);
                }
            });
        });
    } catch (error) {
        console.error('Error loading popular foods:', error);
        DOM.popularFoods.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Unable to load dishes</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// Load Restaurants
async function loadRestaurants() {
    try {
        const response = await fetch('../data/restaurants.json');
        const data = await response.json();
        const restaurants = data.restaurants;
        
        displayRestaurants(restaurants);
        
        // Store restaurants for filtering
        window.allRestaurants = restaurants;
    } catch (error) {
        console.error('Error loading restaurants:', error);
        DOM.restaurantsList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Unable to load restaurants</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// Display Restaurants
function displayRestaurants(restaurants) {
    if (restaurants.length === 0) {
        DOM.restaurantsList.innerHTML = '';
        DOM.noResults.style.display = 'block';
        return;
    }
    
    DOM.noResults.style.display = 'none';
    
    DOM.restaurantsList.innerHTML = restaurants.map(restaurant => `
        <div class="restaurant-card" data-id="${restaurant.id}">
            <div class="restaurant-image">
                <img src="../assets/images/foods/${restaurant.image}" alt="${restaurant.name}">
                ${restaurant.featured ? '<div class="restaurant-badge">Featured</div>' : ''}
                ${!restaurant.is_open ? '<div class="restaurant-closed">Closed</div>' : ''}
            </div>
            <div class="restaurant-info">
                <div class="restaurant-header">
                    <div>
                        <h3 class="restaurant-name">${restaurant.name}</h3>
                        <p class="restaurant-cuisine">${restaurant.cuisine}</p>
                    </div>
                    <div class="restaurant-rating">
                        <i class="fas fa-star"></i>
                        <span>${restaurant.rating}</span>
                    </div>
                </div>
                <p class="restaurant-categories">
                    ${restaurant.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                </p>
                <div class="restaurant-details">
                    <div class="restaurant-detail">
                        <i class="fas fa-clock"></i>
                        <span>${restaurant.delivery_time}</span>
                    </div>
                    <div class="restaurant-detail">
                        <i class="fas fa-truck"></i>
                        <span>$${restaurant.delivery_fee}</span>
                    </div>
                    <div class="restaurant-detail">
                        <i class="fas fa-shopping-bag"></i>
                        <span>$${restaurant.min_order} min</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click event to restaurant cards
    document.querySelectorAll('.restaurant-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const id = card.dataset.id;
            window.location.href = `menu.html?restaurant_id=${id}`;
        });
    });
}

// Load Categories
async function loadCategories() {
    try {
        const response = await fetch('../data/restaurants.json');
        const data = await response.json();
        
        DOM.categoryTabs.innerHTML = data.categories.map(category => `
            <div class="category-item" data-category="${category.toLowerCase()}">
                ${category}
            </div>
        `).join('');
        
        // Add click event to category items
        document.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove active class from all items
                document.querySelectorAll('.category-item').forEach(i => {
                    i.classList.remove('active');
                });
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Filter restaurants by category
                const category = item.dataset.category;
                filterRestaurantsByCategory(category);
            });
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Filter Restaurants by Category
function filterRestaurantsByCategory(category) {
    if (!window.allRestaurants) return;
    
    let filtered = window.allRestaurants;
    
    if (category !== 'all') {
        filtered = window.allRestaurants.filter(restaurant => 
            restaurant.cuisine.toLowerCase() === category ||
            restaurant.categories.some(cat => cat.toLowerCase() === category)
        );
    }
    
    displayRestaurants(filtered);
}

// Setup Restaurant Filters
function setupRestaurantFilters() {
    if (DOM.restaurantSearch) {
        DOM.restaurantSearch.addEventListener('input', debounce(filterRestaurants, 300));
    }
    
    if (DOM.cuisineFilter) {
        DOM.cuisineFilter.addEventListener('change', filterRestaurants);
    }
    
    if (DOM.sortFilter) {
        DOM.sortFilter.addEventListener('change', filterRestaurants);
    }
}

// Filter Restaurants
function filterRestaurants() {
    if (!window.allRestaurants) return;
    
    let filtered = [...window.allRestaurants];
    
    // Filter by search
    const searchTerm = DOM.restaurantSearch?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(restaurant => 
            restaurant.name.toLowerCase().includes(searchTerm) ||
            restaurant.cuisine.toLowerCase().includes(searchTerm) ||
            restaurant.categories.some(cat => cat.toLowerCase().includes(searchTerm))
        );
    }
    
    // Filter by cuisine
    const cuisine = DOM.cuisineFilter?.value || '';
    if (cuisine) {
        filtered = filtered.filter(restaurant => restaurant.cuisine === cuisine);
    }
    
    // Sort
    const sortBy = DOM.sortFilter?.value || 'rating';
    filtered.sort((a, b) => {
        switch (sortBy) {
            case 'rating':
                return b.rating - a.rating;
            case 'delivery_time':
                const aTime = parseInt(a.delivery_time.split('-')[0]);
                const bTime = parseInt(b.delivery_time.split('-')[0]);
                return aTime - bTime;
            case 'delivery_fee':
                return a.delivery_fee - b.delivery_fee;
            case 'name':
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    });
    
    displayRestaurants(filtered);
}

// Load Restaurant Info
async function loadRestaurantInfo(restaurantId) {
    try {
        const response = await fetch('../data/restaurants.json');
        const data = await response.json();
        const restaurant = data.restaurants.find(r => r.id == restaurantId);
        
        if (restaurant) {
            DOM.restaurantHeader.innerHTML = `
                <img src="../assets/images/foods/${restaurant.image}" alt="${restaurant.name}">
                <div class="restaurant-header-info">
                    <h2>${restaurant.name}</h2>
                    <p>${restaurant.cuisine} • ${restaurant.rating} ★ (${restaurant.reviews} reviews)</p>
                    <div class="restaurant-header-details">
                        <div class="restaurant-detail-item">
                            <i class="fas fa-clock"></i>
                            <span>${restaurant.delivery_time} delivery</span>
                        </div>
                        <div class="restaurant-detail-item">
                            <i class="fas fa-truck"></i>
                            <span>Delivery: $${restaurant.delivery_fee}</span>
                        </div>
                        <div class="restaurant-detail-item">
                            <i class="fas fa-shopping-bag"></i>
                            <span>Min order: $${restaurant.min_order}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading restaurant info:', error);
    }
}

// Load Menu Items
async function loadMenuItems(restaurantId) {
    try {
        const [foodsResponse, restaurantsResponse] = await Promise.all([
            fetch('../data/foods.json'),
            fetch('../data/restaurants.json')
        ]);
        
        const foodsData = await foodsResponse.json();
        const restaurantsData = await restaurantsResponse.json();
        
        const restaurant = restaurantsData.restaurants.find(r => r.id == restaurantId);
        const menuItems = foodsData.foods.filter(food => food.restaurant_id == restaurantId);
        
        // Extract unique categories
        const categories = [...new Set(menuItems.map(item => item.category))];
        
        // Display categories
        DOM.menuCategories.innerHTML = `
            <div class="category-item active" data-category="all">All Items</div>
            ${categories.map(category => `
                <div class="category-item" data-category="${category.toLowerCase()}">
                    ${category}
                </div>
            `).join('')}
        `;
        
        // Add click event to category items
        document.querySelectorAll('.menu-categories .category-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove active class from all items
                document.querySelectorAll('.menu-categories .category-item').forEach(i => {
                    i.classList.remove('active');
                });
                
                // Add active class to clicked item
                item.classList.add('active');
                
                // Filter menu items by category
                const category = item.dataset.category;
                displayMenuItems(menuItems, category);
            });
        });
        
        // Display all menu items initially
        displayMenuItems(menuItems, 'all');
    } catch (error) {
        console.error('Error loading menu items:', error);
        DOM.menuItems.innerHTML = `
            <div class="no-results">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Unable to load menu</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// Display Menu Items
function displayMenuItems(items, category) {
    let filteredItems = items;
    
    if (category !== 'all') {
        filteredItems = items.filter(item => 
            item.category.toLowerCase() === category
        );
    }
    
    if (filteredItems.length === 0) {
        DOM.menuItems.innerHTML = `
            <div class="no-results">
                <i class="fas fa-utensils"></i>
                <h3>No items in this category</h3>
                <p>Try another category</p>
            </div>
        `;
        return;
    }
    
    DOM.menuItems.innerHTML = filteredItems.map(item => `
        <div class="food-card" data-id="${item.id}">
            <div class="food-image">
                <img src="../assets/images/foods/${item.image}" alt="${item.name}">
            </div>
            <div class="food-info">
                <div class="food-header">
                    <h3 class="food-name">${item.name}</h3>
                    <div class="food-price">$${item.price}</div>
                </div>
                <p class="food-description">${item.description}</p>
                <div class="food-tags">
                    ${item.vegetarian ? '<span class="food-tag vegetarian">Vegetarian</span>' : ''}
                    ${item.spicy_level > 0 ? `<span class="food-tag spicy">${'🌶'.repeat(item.spicy_level)} Spicy</span>` : ''}
                </div>
                <div class="food-rating">
                    <i class="fas fa-star"></i>
                    <span>${item.rating}</span>
                </div>
                <button class="btn btn-primary add-to-cart-btn" data-id="${item.id}">
                    <i class="fas fa-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `).join('');
    
    // Add click event to add to cart buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            const item = filteredItems.find(i => i.id == itemId);
            
            if (item) {
                // Load restaurant info to get restaurant details
                const restaurantsResponse = await fetch('../data/restaurants.json');
                const restaurantsData = await restaurantsResponse.json();
                const restaurant = restaurantsData.restaurants.find(r => r.id == item.restaurant_id);
                
                showAddToCartModal(item, restaurant);
            }
        });
    });
}

// Show Add to Cart Modal
function showAddToCartModal(item, restaurant = null) {
    const modal = DOM.addToCartModal;
    const name = document.getElementById('modal-item-name');
    const description = document.getElementById('modal-item-description');
    const price = document.getElementById('modal-item-price');
    const total = document.getElementById('modal-total-price');
    const addonsList = document.getElementById('addons-list');
    
    // Set item details
    name.textContent = item.name;
    description.textContent = item.description;
    price.textContent = `$${item.price}`;
    total.textContent = `$${item.price}`;
    
    // Set addons
    addonsList.innerHTML = item.addons ? item.addons.map(addon => `
        <div class="addon-item" data-price="${addon.price}">
            <div class="addon-info">
                <div class="addon-checkbox"></div>
                <span>${addon.name}</span>
            </div>
            <div class="addon-price">+$${addon.price}</div>
        </div>
    `).join('') : '<p>No addons available</p>';
    
    // Reset quantity
    document.getElementById('item-quantity').value = 1;
    
    // Show modal
    modal.classList.add('show');
    
    // Store current item and restaurant
    window.currentItem = item;
    window.currentRestaurant = restaurant;
    
    // Setup modal events
    setupModalEvents();
}

// Setup Modal Events
function setupModalEvents() {
    const modal = DOM.addToCartModal;
    const closeBtn = modal.querySelector('.modal-close');
    const decreaseBtn = document.getElementById('decrease-qty');
    const increaseBtn = document.getElementById('increase-qty');
    const quantityInput = document.getElementById('item-quantity');
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const addonItems = modal.querySelectorAll('.addon-item');
    
    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Quantity controls
    decreaseBtn.addEventListener('click', () => {
        const current = parseInt(quantityInput.value);
        if (current > 1) {
            quantityInput.value = current - 1;
            updateModalTotal();
        }
    });
    
    increaseBtn.addEventListener('click', () => {
        const current = parseInt(quantityInput.value);
        if (current < 10) {
            quantityInput.value = current + 1;
            updateModalTotal();
        }
    });
    
    quantityInput.addEventListener('change', () => {
        let value = parseInt(quantityInput.value);
        if (value < 1) value = 1;
        if (value > 10) value = 10;
        quantityInput.value = value;
        updateModalTotal();
    });
    
    // Addon selection
    addonItems.forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('selected');
            updateModalTotal();
        });
    });
    
    // Add to cart button
    addToCartBtn.addEventListener('click', () => {
        addItemToCart();
        modal.classList.remove('show');
    });
}

// Update Modal Total
function updateModalTotal() {
    const quantity = parseInt(document.getElementById('item-quantity').value);
    const itemPrice = window.currentItem.price;
    const addonItems = document.querySelectorAll('.addon-item.selected');
    
    let addonsTotal = 0;
    addonItems.forEach(item => {
        addonsTotal += parseFloat(item.dataset.price);
    });
    
    const total = (itemPrice + addonsTotal) * quantity;
    document.getElementById('modal-total-price').textContent = `$${total.toFixed(2)}`;
}

// Add Item to Cart
function addItemToCart() {
    const quantity = parseInt(document.getElementById('item-quantity').value);
    const addonItems = document.querySelectorAll('.addon-item.selected');
    const instructions = document.getElementById('instructions').value;
    
    let addons = [];
    addonItems.forEach(item => {
        const name = item.querySelector('.addon-info span').textContent;
        const price = parseFloat(item.dataset.price);
        addons.push({ name, price });
    });
    
    const item = {
        ...window.currentItem,
        quantity,
        addons,
        instructions,
        totalPrice: (window.currentItem.price + addons.reduce((sum, a) => sum + a.price, 0)) * quantity,
        restaurant: window.currentRestaurant
    };
    
    // Get current cart
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    
    // Check if item already exists in cart
    const existingIndex = cart.findIndex(i => 
        i.id === item.id && 
        JSON.stringify(i.addons) === JSON.stringify(addons)
    );
    
    if (existingIndex > -1) {
        // Update quantity if item exists
        cart[existingIndex].quantity += quantity;
        cart[existingIndex].totalPrice = (cart[existingIndex].price + addons.reduce((sum, a) => sum + a.price, 0)) * cart[existingIndex].quantity;
    } else {
        // Add new item
        cart.push(item);
    }
    
    // Save cart
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Update cart count
    updateCartCount();
    
    // Show notification
    showNotification('Item added to cart!', 'success');
    
    // Clear instructions
    document.getElementById('instructions').value = '';
}

// Load Orders
function loadOrders() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    
    if (orders.length === 0) {
        DOM.ordersList.innerHTML = '';
        DOM.noOrders.style.display = 'block';
        return;
    }
    
    DOM.noOrders.style.display = 'none';
    
    DOM.ordersList.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-header">
                <div>
                    <h3>Order #${order.id}</h3>
                    <p class="order-status ${order.status}">${getStatusText(order.status)} on ${order.date}</p>
                </div>
                <div class="order-total">$${order.total}</div>
            </div>
            <div class="order-restaurant">
                <img src="../assets/images/foods/${order.restaurantImage}" alt="${order.restaurant}">
                <div>
                    <h4>${order.restaurant}</h4>
                    <p>${order.cuisine} • ${order.rating} ★</p>
                </div>
            </div>
            <div class="order-items">
                ${order.items.slice(0, 2).map(item => `
                    <div class="order-item">
                        <span>${item.quantity}× ${item.name}</span>
                        <span>$${item.price}</span>
                    </div>
                `).join('')}
                ${order.items.length > 2 ? `
                    <div class="order-item">
                        <span>+${order.items.length - 2} more items</span>
                        <span></span>
                    </div>
                ` : ''}
            </div>
            <div class="order-actions">
                <button class="btn btn-outline reorder-btn" data-order-id="${order.id}">
                    <i class="fas fa-redo"></i> Reorder
                </button>
                <button class="btn btn-outline">
                    <i class="fas fa-star"></i> Rate Order
                </button>
            </div>
        </div>
    `).join('');
    
    // Add reorder functionality
    document.querySelectorAll('.reorder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const orderId = btn.dataset.orderId;
            reorder(orderId);
        });
    });
}

// Get Status Text
function getStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'preparing': 'Preparing',
        'delivering': 'On the Way',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
    };
    return statusMap[status] || status;
}

// Setup Order Tabs
function setupOrderTabs() {
    DOM.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            DOM.tabBtns.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Filter orders by status
            const status = btn.dataset.status;
            filterOrders(status);
        });
    });
}

// Filter Orders by Status
function filterOrders(status) {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    
    if (status === 'all') {
        loadOrders();
        return;
    }
    
    const filtered = orders.filter(order => order.status === status);
    
    if (filtered.length === 0) {
        DOM.ordersList.innerHTML = '';
        DOM.noOrders.style.display = 'block';
        return;
    }
    
    DOM.noOrders.style.display = 'none';
    
    // Display filtered orders (similar to loadOrders but with filtered array)
    // ... (omitted for brevity)
}

// Setup Add to Cart Modal
function setupAddToCartModal() {
    // Already handled in showAddToCartModal
}

// Setup Checkout Modal
function setupCheckoutModal() {
    if (DOM.checkoutBtn) {
        DOM.checkoutBtn.addEventListener('click', () => {
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            
            if (cart.length === 0) {
                showNotification('Your cart is empty!', 'error');
                return;
            }
            
            // Check if user is logged in
            if (localStorage.getItem('userLoggedIn') !== 'true') {
                showNotification('Please login to checkout', 'error');
                setTimeout(() => {
                    window.location.href = 'login.html?redirect=cart';
                }, 1500);
                return;
            }
            
            DOM.checkoutModal.classList.add('show');
            setupCheckoutSteps();
        });
    }
}

// Setup Checkout Steps
function setupCheckoutSteps() {
    const steps = document.querySelectorAll('.checkout-step');
    const stepButtons = document.querySelectorAll('.checkout-steps .step');
    const prevBtn = document.getElementById('prev-step');
    const nextBtn = document.getElementById('next-step');
    const placeOrderBtn = document.getElementById('place-order');
    const backToHomeBtn = document.getElementById('back-to-home');
    
    let currentStep = 1;
    const totalSteps = 3;
    
    // Update step display
    function updateSteps() {
        steps.forEach(step => step.classList.remove('active'));
        stepButtons.forEach(btn => {
            btn.classList.remove('active', 'completed');
            const stepNum = parseInt(btn.dataset.step);
            if (stepNum < currentStep) {
                btn.classList.add('completed');
            } else if (stepNum === currentStep) {
                btn.classList.add('active');
            }
        });
        
        document.getElementById(`step-${currentStep}`).classList.add('active');
        
        // Update buttons
        prevBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
        
        if (currentStep < totalSteps) {
            nextBtn.style.display = 'inline-flex';
            placeOrderBtn.style.display = 'none';
            backToHomeBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'none';
            placeOrderBtn.style.display = 'inline-flex';
        }
        
        // If on confirmation step after placing order
        if (currentStep === totalSteps && localStorage.getItem('orderPlaced') === 'true') {
            placeOrderBtn.style.display = 'none';
            backToHomeBtn.style.display = 'inline-flex';
        }
    }
    
    // Next step
    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            currentStep++;
            updateSteps();
        }
    });
    
    // Previous step
    prevBtn.addEventListener('click', () => {
        currentStep--;
        updateSteps();
    });
    
    // Place order
    placeOrderBtn.addEventListener('click', () => {
        placeOrder();
    });
    
    // Payment method change
    document.querySelectorAll('input[name="payment"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const method = e.target.value;
            const cardDetails = document.getElementById('card-details');
            
            if (method === 'card') {
                cardDetails.style.display = 'block';
            } else {
                cardDetails.style.display = 'none';
            }
        });
    });
    
    // Close modal
    const closeBtn = DOM.checkoutModal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
        DOM.checkoutModal.classList.remove('show');
    });
    
    DOM.checkoutModal.addEventListener('click', (e) => {
        if (e.target === DOM.checkoutModal) {
            DOM.checkoutModal.classList.remove('show');
        }
    });
    
    // Initialize
    updateSteps();
}

// Validate Step
function validateStep(step) {
    switch (step) {
        case 1:
            const address = document.getElementById('delivery-address').value;
            const contactName = document.getElementById('contact-name').value;
            const contactPhone = document.getElementById('contact-phone').value;
            
            if (!address.trim()) {
                showNotification('Please enter delivery address', 'error');
                return false;
            }
            if (!contactName.trim()) {
                showNotification('Please enter contact name', 'error');
                return false;
            }
            if (!contactPhone.trim()) {
                showNotification('Please enter phone number', 'error');
                return false;
            }
            return true;
            
        case 2:
            const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
            
            if (paymentMethod === 'card') {
                const cardNumber = document.getElementById('card-number').value;
                const expiryDate = document.getElementById('expiry-date').value;
                const cvv = document.getElementById('cvv').value;
                
                if (!cardNumber.trim() || !expiryDate.trim() || !cvv.trim()) {
                    showNotification('Please enter card details', 'error');
                    return false;
                }
            }
            return true;
            
        default:
            return true;
    }
}

// Place Order
function placeOrder() {
    // Generate order data
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const order = {
        id: 'ORD' + Date.now().toString().slice(-8),
        date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        time: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        }),
        items: cart,
        subtotal: cart.reduce((sum, item) => sum + item.totalPrice, 0),
        deliveryFee: 2.99,
        tax: 0.085,
        total: 0,
        status: 'pending',
        restaurant: cart[0]?.restaurant?.name || 'Unknown',
        restaurantImage: cart[0]?.restaurant?.image || 'restaurant.png',
        cuisine: cart[0]?.restaurant?.cuisine || 'Unknown',
        rating: cart[0]?.restaurant?.rating || 4.0,
        address: document.getElementById('delivery-address').value,
        contactName: document.getElementById('contact-name').value,
        contactPhone: document.getElementById('contact-phone').value,
        paymentMethod: document.querySelector('input[name="payment"]:checked').value
    };
    
    // Calculate total
    order.total = (order.subtotal + order.deliveryFee) * (1 + order.tax);
    
    // Save order
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    
    // Clear cart
    localStorage.removeItem('cart');
    
    // Update cart count
    updateCartCount();
    
    // Mark order as placed
    localStorage.setItem('orderPlaced', 'true');
    
    // Update confirmation screen
    document.getElementById('order-number').textContent = order.id;
    document.getElementById('confirmed-delivery-time').textContent = 
        cart[0]?.restaurant?.delivery_time || '25-35 minutes';
    
    // Update order summary in confirmation
    const confirmItems = document.getElementById('confirm-items');
    confirmItems.innerHTML = cart.map(item => `
        <div class="summary-item">
            <span>${item.quantity}× ${item.name}</span>
            <span>$${item.totalPrice.toFixed(2)}</span>
        </div>
    `).join('');
    
    document.getElementById('confirm-total').textContent = `$${order.total.toFixed(2)}`;
    
    // Move to confirmation step
    const nextBtn = document.getElementById('next-step');
    nextBtn.click();
    
    // Show success notification
    showNotification('Order placed successfully!', 'success');
}

// Reorder
function reorder(orderId) {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
        showNotification('Order not found', 'error');
        return;
    }
    
    // Clear current cart
    localStorage.setItem('cart', JSON.stringify(order.items));
    
    // Update cart count
    updateCartCount();
    
    // Redirect to cart
    showNotification('Items added to cart!', 'success');
    setTimeout(() => {
        window.location.href = 'cart.html';
    }, 1500);
}

// Initialize Modals
function initModals() {
    // Close all modals when ESC is pressed
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });
}

// Show Notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Get Notification Icon
function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: var(--radius-sm);
        background-color: var(--white);
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 9999;
        transform: translateX(150%);
        transition: transform 0.3s ease;
        max-width: 350px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left: 4px solid var(--success-color);
    }
    
    .notification.error {
        border-left: 4px solid var(--danger-color);
    }
    
    .notification.warning {
        border-left: 4px solid var(--warning-color);
    }
    
    .notification.info {
        border-left: 4px solid var(--accent-color);
    }
    
    .notification i {
        font-size: 1.2rem;
    }
    
    .notification.success i {
        color: var(--success-color);
    }
    
    .notification.error i {
        color: var(--danger-color);
    }
    
    .notification.warning i {
        color: var(--warning-color);
    }
    
    .notification.info i {
        color: var(--accent-color);
    }
    
    .notification span {
        flex: 1;
        font-weight: 500;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: var(--gray-color);
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: var(--transition);
    }
    
    .notification-close:hover {
        background-color: var(--light-gray);
        color: var(--dark-color);
    }
`;
document.head.appendChild(notificationStyles);

// API Configuration
const API_BASE_URL = 'http://localhost:8000/api';
let authToken = localStorage.getItem('access_token');

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
            ...options.headers
        },
        credentials: 'include'  // Important for CORS with credentials
    };
    
    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        // Handle token refresh if 401
        if (response.status === 401 && authToken) {
            // Try to refresh token
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                const refreshResponse = await fetch(`${API_BASE_URL}/auth/login/refresh/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh: refreshToken })
                });
                
                if (refreshResponse.ok) {
                    const { access } = await refreshResponse.json();
                    localStorage.setItem('access_token', access);
                    authToken = access;
                    
                    // Retry original request
                    defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
                    return await fetch(url, { ...defaultOptions, ...options });
                }
            }
        }
        
        return response;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}