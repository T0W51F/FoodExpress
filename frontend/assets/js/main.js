// DOM Elements
const DOM = {
    menuToggle: document.querySelector('.menu-toggle'),
    navLinks: document.querySelector('.nav-links'),
    cartCounts: document.querySelectorAll('.cart-count'),
    mobileCartCount: document.getElementById('mobile-cart-count'),
    mobileCartTotal: document.getElementById('mobile-cart-total'),
    checkoutBtn: document.getElementById('checkout-btn'),
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
    username: document.getElementById('username'),
    heroSearchForm: document.getElementById('hero-search-form'),
    heroSearchInput: document.getElementById('address-input'),
    heroSearchBtn: document.getElementById('hero-search-btn')
};

async function apiCall(endpoint, options = {}) {
    const baseUrl = window.API?.config?.BASE_URL || 'http://localhost:5000/api';
    const token = localStorage.getItem('access_token');
    const headers = { Accept: 'application/json', ...(options.headers || {}) };

    if (!headers['Content-Type'] && options.body) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(`${baseUrl}${endpoint}`, { ...options, headers });
}

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
    document.querySelectorAll('.user-menu').forEach(menu => {
        const btn = menu.querySelector('.user-btn');
        const dropdown = menu.querySelector('.user-dropdown');
        if (!btn || !dropdown) {
            return;
        }

        btn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.user-dropdown.show').forEach(openDropdown => {
                if (openDropdown !== dropdown) {
                    openDropdown.classList.remove('show');
                }
            });
            dropdown.classList.toggle('show');
        };

        dropdown.onclick = (e) => {
            e.stopPropagation();
        };
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.user-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });
}

// Check Login Status
function getRoleDashboardLink(user) {
    if (user.role === 'superadmin') {
        return '<a href="superadmin.html" class="admin-link"><i class="fas fa-crown"></i> Super Admin</a>';
    }
    if (user.role === 'restaurant_admin') {
        return '<a href="partner-dashboard.html" class="admin-link"><i class="fas fa-store"></i> My Restaurant</a>';
    }
    return '';
}

function buildUserMenuHTML(user) {
    const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.trim() || 'U';
    const roleLink = getRoleDashboardLink(user);

    return `
        <div class="user-menu">
            <button class="user-btn" type="button">
                <span class="user-avatar">${initials.toUpperCase()}</span>
                <span class="user-name">${user.firstName || 'User'}</span>
                <i class="fas fa-chevron-down"></i>
            </button>
            <div class="user-dropdown">
                ${roleLink}
                <a href="settings.html"><i class="fas fa-cog"></i> Settings</a>
                <hr>
                <a href="#" data-logout="true"><i class="fas fa-sign-out-alt"></i> Logout</a>
            </div>
        </div>
    `;
}

function ensureOrdersNavLink(user, isLoggedIn) {
    if (!DOM.navLinks) {
        return;
    }

    const existingOrdersLink = DOM.navLinks.querySelector('.orders-nav-link, a[href="orders.html"]');
    const nonCustomerRoles = ['admin', 'superadmin', 'restaurant_admin'];
    const shouldShowOrders = !isLoggedIn || !nonCustomerRoles.includes(user.role);

    if (!shouldShowOrders) {
        existingOrdersLink?.remove();
        return;
    }

    if (existingOrdersLink) {
        return;
    }

    const cartLink = DOM.navLinks.querySelector('.cart-icon');
    const ordersLink = document.createElement('a');
    ordersLink.href = 'orders.html';
    ordersLink.className = 'orders-nav-link';
    ordersLink.textContent = 'My Orders';

    if (cartLink) {
        DOM.navLinks.insertBefore(ordersLink, cartLink);
    } else {
        DOM.navLinks.appendChild(ordersLink);
    }
}

function ensureAdminNavLink(user) {
    if (!DOM.navLinks || DOM.navLinks.querySelector('.admin-nav-link')) {
        return;
    }

    let href = null;
    let label = null;
    if (user.role === 'superadmin') {
        href = 'superadmin.html';
        label = 'Super Admin';
    } else if (user.role === 'restaurant_admin') {
        href = 'partner-dashboard.html';
        label = 'My Restaurant';
    }

    if (!href) return;

    const adminLink = document.createElement('a');
    adminLink.href = href;
    adminLink.className = 'admin-nav-link';
    adminLink.textContent = label;

    const cartIcon = DOM.navLinks.querySelector('.cart-icon');
    if (cartIcon) {
        DOM.navLinks.insertBefore(adminLink, cartIcon);
    } else {
        DOM.navLinks.appendChild(adminLink);
    }
}

function bindUserMenuState() {
    document.querySelectorAll('[data-logout="true"], #logout-btn').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('userLoggedIn');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        };
    });

    initUserMenu();
}

function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('userLoggedIn') === 'true';
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (DOM.username) {
        DOM.username.textContent = isLoggedIn ? (user.firstName || 'User') : 'Guest';
    }

    document.querySelectorAll('.auth-buttons').forEach(container => {
        if (isLoggedIn) {
            container.innerHTML = buildUserMenuHTML(user);
        }
    });

    document.querySelectorAll('.user-menu').forEach(menu => {
        if (!isLoggedIn) {
            return;
        }

        const button = menu.querySelector('.user-btn');
        const dropdown = menu.querySelector('.user-dropdown');
        if (button) {
            const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.trim() || 'U';
            button.innerHTML = `
                <span class="user-avatar">${initials.toUpperCase()}</span>
                <span class="user-name">${user.firstName || 'User'}</span>
                <i class="fas fa-chevron-down"></i>
            `;
        }
        if (dropdown) {
            dropdown.innerHTML = `
                ${getRoleDashboardLink(user)}
                <a href="settings.html"><i class="fas fa-cog"></i> Settings</a>
                <hr>
                <a href="#" data-logout="true"><i class="fas fa-sign-out-alt"></i> Logout</a>
            `;
        }
    });

    ensureOrdersNavLink(user, isLoggedIn);
    if (isLoggedIn) {
        ensureAdminNavLink(user);
    }

    // Hide "Partner with us" for staff/admin roles — they already have a restaurant
    const hidePartnerLink = isLoggedIn && ['restaurant_admin', 'admin', 'superadmin'].includes(user.role);
    document.querySelectorAll('.partner-nav-link').forEach(el => {
        el.style.display = hidePartnerLink ? 'none' : '';
    });

    bindUserMenuState();

    document.querySelectorAll('.nav-links').forEach(el => el.classList.add('nav-ready'));
    document.querySelectorAll('.auth-buttons').forEach(el => el.classList.add('auth-ready'));
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
        DOM.mobileCartTotal.textContent = `${subtotal.toFixed(2)}Tk`;
    }
}

function getRestaurantSearchTermFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('search') || params.get('q') || '').trim();
}

function getRestaurantFoods(restaurantId) {
    return (window.allFoods || []).filter(food => String(food.restaurant_id) === String(restaurantId));
}


// Returns true if all chars of query appear in target in order (case-insensitive)
function fuzzyMatch(query, target) {
    if (!query || !target) return false;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
}

// Returns a numeric relevance score for a restaurant against a query.
// Higher = better match. 0 = no match.
function scoreRestaurantMatch(restaurant, query, foods) {
    const q = query.toLowerCase().trim();
    if (!q) return 0;

    const name = (restaurant.name || '').toLowerCase();
    const cuisine = (restaurant.cuisine || '').toLowerCase();
    const serviceArea = (restaurant.service_area || '').toLowerCase();
    const categories = (restaurant.categories || []).map(c => c.toLowerCase());
    // foods param may differ from window.allFoods (e.g. autocomplete uses searchCache.foods)
    const restaurantFoods = (foods || []).filter(f => String(f.restaurant_id) === String(restaurant.id));

    let score = 0;

    // Name matches
    if (name === q) score += 100;
    else if (name.includes(q)) score += 80;
    else if (fuzzyMatch(q, name)) score += 20;

    // Cuisine / category matches
    if (cuisine === q || categories.includes(q)) score += 60;
    else if (cuisine.includes(q) || categories.some(c => c.includes(q))) score += 40;
    else if (fuzzyMatch(q, cuisine) || categories.some(c => fuzzyMatch(q, c))) score += 20;

    // Service area match
    if (serviceArea.includes(q)) score += 15;

    // Food item matches
    for (const food of restaurantFoods) {
        const fname = (food.name || '').toLowerCase();
        const fdesc = (food.description || '').toLowerCase();
        const fcat  = (food.category || '').toLowerCase();
        if (fname.includes(q)) { score += 40; break; }
        if (fcat.includes(q))  { score += 30; break; }
        if (fdesc.includes(q)) { score += 10; break; }
        if (fuzzyMatch(q, fname)) { score += 20; break; }
    }

    return score;
}

function syncRestaurantSearchUrl(searchTerm = '') {
    if (!DOM.restaurantSearch) return;
    const nextUrl = new URL(window.location.href);
    if (searchTerm) {
        nextUrl.searchParams.set('search', searchTerm);
    } else {
        nextUrl.searchParams.delete('search');
        nextUrl.searchParams.delete('q');
    }
    window.history.replaceState({}, '', nextUrl);
}

function initHeroSearch() {
    if (!DOM.heroSearchForm || !DOM.heroSearchInput) return;

    let suggestionsEl = null;
    let activeIndex = -1;
    let suggestionItems = [];

    // --- data cache ---
    async function getSearchCache() {
        if (window.searchCache) return window.searchCache;
        const [rRes, fRes] = await Promise.all([
            apiCall('/restaurants/restaurants/'),
            apiCall('/restaurants/foods/')
        ]);
        const [rData, fData] = await Promise.all([rRes.json(), fRes.json()]);
        const restaurants = rData.results || [];
        const foods = fData.results || fData || [];
        // Collect unique categories from all restaurants
        const categorySet = new Set();
        restaurants.forEach(r => {
            if (r.cuisine) categorySet.add(r.cuisine);
            (r.categories || []).forEach(c => categorySet.add(c));
        });
        window.searchCache = { restaurants, foods, categories: [...categorySet] };
        return window.searchCache;
    }

    // --- build suggestions ---
    function buildSuggestions(restaurants, foods, categories, query) {
        const q = query.toLowerCase();
        const matchStr = s => s && (s.toLowerCase().includes(q) || fuzzyMatch(q, s));

        const matchedRestaurants = restaurants
            .filter(r => matchStr(r.name) || matchStr(r.cuisine) || (r.categories || []).some(matchStr))
            .slice(0, 3);

        const matchedCategories = categories
            .filter(c => matchStr(c))
            .slice(0, 3);

        const matchedFoods = foods
            .filter(f => matchStr(f.name))
            .slice(0, 2);

        return { matchedRestaurants, matchedCategories, matchedFoods };
    }

    // --- render dropdown ---
    function renderDropdown(matchedRestaurants, matchedCategories, matchedFoods) {
        closeSuggestions();
        const total = matchedRestaurants.length + matchedCategories.length + matchedFoods.length;
        if (total === 0) return;

        suggestionsEl = document.createElement('div');
        suggestionsEl.className = 'search-suggestions';
        suggestionItems = [];

        function addSection(label, items, renderItem) {
            if (!items.length) return;
            const section = document.createElement('div');
            section.className = 'search-suggestions-section';
            const labelEl = document.createElement('div');
            labelEl.className = 'search-suggestions-label';
            labelEl.textContent = label;
            section.appendChild(labelEl);
            items.forEach(item => {
                const el = renderItem(item);
                el.classList.add('search-suggestion-item');
                el.setAttribute('role', 'option');
                section.appendChild(el);
                suggestionItems.push(el);
            });
            suggestionsEl.appendChild(section);
        }

        addSection('Restaurants', matchedRestaurants, r => {
            const el = document.createElement('div');
            const icon = document.createElement('i');
            icon.className = 'fas fa-utensils';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = r.name;
            const subSpan = document.createElement('span');
            subSpan.className = 'search-suggestion-sub';
            subSpan.textContent = r.cuisine || '';
            el.append(icon, nameSpan, subSpan);
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                window.location.href = `menu.html?restaurant_id=${r.id}`;
            });
            return el;
        });

        addSection('Categories', matchedCategories, cat => {
            const el = document.createElement('div');
            const icon = document.createElement('i');
            icon.className = 'fas fa-tag';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = cat;
            el.append(icon, nameSpan);
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                const url = new URL('restaurants.html', window.location.href);
                url.searchParams.set('cuisine', cat);
                window.location.href = url.toString();
            });
            return el;
        });

        addSection('Foods', matchedFoods, food => {
            const el = document.createElement('div');
            const icon = document.createElement('i');
            icon.className = 'fas fa-hamburger';
            const nameSpan = document.createElement('span');
            nameSpan.textContent = food.name;
            el.append(icon, nameSpan);
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                const url = new URL('restaurants.html', window.location.href);
                url.searchParams.set('search', food.name);
                window.location.href = url.toString();
            });
            return el;
        });

        // Append to body so backdrop-filter/overflow:hidden on hero container can't clip it
        document.body.appendChild(suggestionsEl);
        suggestionsEl.style.position = 'fixed';
        suggestionsEl.style.zIndex = '9999';
        positionDropdown();
        activeIndex = -1;
    }

    function positionDropdown() {
        if (!suggestionsEl) return;
        const rect = DOM.heroSearchForm.getBoundingClientRect();
        suggestionsEl.style.top = `${rect.bottom + 4}px`;
        suggestionsEl.style.left = `${rect.left}px`;
        suggestionsEl.style.width = `${rect.width}px`;
    }

    function closeSuggestions() {
        if (suggestionsEl) {
            suggestionsEl.remove();
            suggestionsEl = null;
        }
        activeIndex = -1;
        suggestionItems = [];
    }

    function setActiveItem(index) {
        suggestionItems.forEach((el, i) => el.classList.toggle('active', i === index));
        activeIndex = index;
    }

    // --- debounce helper ---
    let debounceTimer;
    function debounceInput(fn, delay) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, delay);
    }

    // --- events ---
    DOM.heroSearchInput.addEventListener('input', () => {
        const query = DOM.heroSearchInput.value.trim();
        if (query.length < 2) { closeSuggestions(); return; }
        debounceInput(async () => {
            try {
                const { restaurants, foods, categories } = await getSearchCache();
                const { matchedRestaurants, matchedCategories, matchedFoods } =
                    buildSuggestions(restaurants, foods, categories, query);
                renderDropdown(matchedRestaurants, matchedCategories, matchedFoods);
            } catch (e) {
                console.error('Autocomplete error:', e);
            }
        }, 200);
    });

    DOM.heroSearchInput.addEventListener('keydown', e => {
        if (!suggestionsEl) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveItem(Math.min(activeIndex + 1, suggestionItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveItem(activeIndex <= 0 ? -1 : activeIndex - 1);
        } else if (e.key === 'Escape') {
            closeSuggestions();
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            suggestionItems[activeIndex].dispatchEvent(new MouseEvent('mousedown'));
        }
    });

    DOM.heroSearchInput.addEventListener('blur', () => {
        // Small delay so mousedown on item fires first
        setTimeout(closeSuggestions, 150);
    });

    DOM.heroSearchForm.addEventListener('submit', event => {
        event.preventDefault();
        closeSuggestions();
        const query = DOM.heroSearchInput.value.trim();
        const nextUrl = new URL('restaurants.html', window.location.href);
        if (query) nextUrl.searchParams.set('search', query);
        window.location.href = nextUrl.toString();
    });

    const _outsideClickHandler = e => {
        if (!DOM.heroSearchForm.contains(e.target) && e.target !== suggestionsEl && !suggestionsEl?.contains(e.target)) closeSuggestions();
    };
    document.addEventListener('click', _outsideClickHandler);

    window.addEventListener('scroll', positionDropdown, { passive: true });
    window.addEventListener('resize', positionDropdown, { passive: true });
}

let _animObserver = null;

function initScrollAnimations() {
    _animObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                _animObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('[data-animate]').forEach(el => _animObserver.observe(el));
}

function observeNewAnimations(container) {
    if (!_animObserver) return;
    container.querySelectorAll('[data-animate]').forEach(el => _animObserver.observe(el));
}

// Load Featured Restaurants
async function loadFeaturedRestaurants() {
    try {
        const response = await apiCall('/restaurants/restaurants/');
        const data = await response.json();
        const featured = (data.results || []).filter(r => r.featured).slice(0, 3);

        DOM.featuredRestaurants.innerHTML = featured.map(restaurant => `
            <div class="card-glow" data-animate>
                <div class="restaurant-card" data-id="${restaurant.id}">
                    <div class="restaurant-image">
                        <img src="../assets/images/foods/${restaurant.image}" alt="${restaurant.name}">
                        ${restaurant.featured ? '<div class="restaurant-badge">Featured</div>' : ''}
                        ${!restaurant.is_open ? '<div class="restaurant-closed">Closed</div>' : ''}
                    </div>
                    <div class="restaurant-info">
                        <div class="restaurant-header">
                            <div class="restaurant-copy">
                                <div class="restaurant-meta">${restaurant.cuisine}</div>
                                <h3 class="restaurant-name">${restaurant.name}</h3>
                                <p class="restaurant-summary">Fast comfort food with polished delivery details and a focused first menu.</p>
                            </div>
                            <div class="restaurant-rating"><i class="fas fa-star"></i><span>${restaurant.rating}</span></div>
                        </div>
                        <div class="restaurant-details">
                            <div class="restaurant-detail"><i class="fas fa-clock"></i><span>${restaurant.delivery_time}</span></div>
                            <div class="restaurant-detail"><i class="fas fa-truck"></i><span>Tk ${restaurant.delivery_fee} delivery</span></div>
                            <div class="restaurant-detail"><i class="fas fa-shopping-bag"></i><span>Tk ${restaurant.min_order} min. order</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('#featured-restaurants .restaurant-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `menu.html?restaurant_id=${card.dataset.id}`;
            });
        });
        observeNewAnimations(DOM.featuredRestaurants);
    } catch (error) {
        console.error('Error loading featured restaurants:', error);
    }
}

// Load Popular Foods
async function loadPopularFoods() {
    try {
        const response = await apiCall('/restaurants/foods/?popular=true');
        const data = await response.json();
        const popular = (data.results || []).slice(0, 6);

        DOM.popularFoods.innerHTML = popular.map(food => `
            <div class="card-glow" data-animate>
                <div class="food-card" data-id="${food.id}">
                    <div class="food-image"><img src="../assets/images/foods/${food.image}" alt="${food.name}"></div>
                    <div class="food-info">
                        <div class="food-header"><h3 class="food-name">${food.name}</h3><div class="food-price">Tk ${food.price}</div></div>
                        <p class="food-description">${food.description}</p>
                        <div class="food-tags">${food.vegetarian ? '<span class="food-tag vegetarian">Vegetarian</span>' : ''}</div>
                        <div class="food-rating"><i class="fas fa-star"></i><span>${food.rating}</span></div>
                        <button class="btn btn-primary add-to-cart-btn" data-id="${food.id}"><i class="fas fa-plus"></i> Add to Cart</button>
                    </div>
                </div>
            </div>
        `).join('');
        observeNewAnimations(DOM.popularFoods);
    } catch (error) {
        console.error('Error loading popular foods:', error);
    }
}

// Load Restaurants
async function loadRestaurants() {
    try {
        const [restaurantsResponse, foodsResponse] = await Promise.all([
            apiCall('/restaurants/restaurants/'),
            apiCall('/restaurants/foods/')
        ]);
        const [restaurantsData, foodsData] = await Promise.all([
            restaurantsResponse.json(),
            foodsResponse.json()
        ]);
        window.allRestaurants = restaurantsData.results || [];
        window.allFoods = foodsData.results || [];

        const initialSearch = getRestaurantSearchTermFromUrl();
        if (DOM.restaurantSearch && initialSearch) {
            DOM.restaurantSearch.value = initialSearch;
        }

        const params = new URLSearchParams(window.location.search);
        const initialCuisine = params.get('cuisine') || '';
        let tempCuisineOpt = null;
        if (DOM.cuisineFilter && initialCuisine) {
            const existing = Array.from(DOM.cuisineFilter.options).find(
                o => o.value.toLowerCase() === initialCuisine.toLowerCase()
            );
            if (existing) {
                DOM.cuisineFilter.value = existing.value;
            } else {
                tempCuisineOpt = document.createElement('option');
                tempCuisineOpt.value = initialCuisine;
                tempCuisineOpt.textContent = initialCuisine;
                DOM.cuisineFilter.appendChild(tempCuisineOpt);
                DOM.cuisineFilter.value = initialCuisine;
            }
        }

        filterRestaurants();
        if (tempCuisineOpt) {
            DOM.cuisineFilter.value = '';
            tempCuisineOpt.remove();
        }
    } catch (error) {
        console.error('Error loading restaurants:', error);
        if (DOM.restaurantsList) {
            DOM.restaurantsList.innerHTML = `<div class="no-results"><i class="fas fa-exclamation-circle"></i><h3>Unable to load restaurants</h3><p>Please try again later</p></div>`;
        }
    }
}

// Display Restaurants
function displayRestaurants(restaurants) {
    if (restaurants.length === 0) {
        DOM.restaurantsList.innerHTML = '';
        if (DOM.noResults) DOM.noResults.style.display = 'block';
        return;
    }

    if (DOM.noResults) DOM.noResults.style.display = 'none';
    DOM.restaurantsList.innerHTML = restaurants.map(restaurant => `
        <div class="card-glow">
        <article class="restaurant-card" data-id="${restaurant.id}">
            <div class="restaurant-image">
                <img src="../assets/images/foods/${restaurant.image}" alt="${restaurant.name}">
                ${restaurant.featured ? '<div class="restaurant-badge">Featured</div>' : ''}
                ${!restaurant.is_open ? '<div class="restaurant-closed">Closed</div>' : ''}
            </div>
            <div class="restaurant-info">
                <div class="restaurant-header">
                    <div class="restaurant-copy">
                        <div class="restaurant-meta">Free delivery for first order</div>
                        <h3 class="restaurant-name">${restaurant.name}</h3>
                        <p class="restaurant-summary"><i class="fas fa-star"></i> 4.7/5 (10000+)</p>
                    </div>
                    <div class="restaurant-rating"><i class="fas fa-star"></i><span>${restaurant.rating}</span></div>
                </div>
                <div class="restaurant-categories">
                    ${restaurant.categories.map(cat => {
                        const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        return `<a class="category-tag" href="menu.html?restaurant_id=${restaurant.id}#menu-section-${slug}">${cat}</a>`;
                    }).join('')}
                </div>
                <div class="restaurant-details">
                    <div class="restaurant-detail"><i class="fas fa-clock"></i><span>${restaurant.delivery_time}</span></div>
                    <div class="restaurant-detail"><i class="fas fa-truck"></i><span>Tk ${restaurant.delivery_fee} delivery</span></div>
                    <div class="restaurant-detail"><i class="fas fa-shopping-bag"></i><span>Tk ${restaurant.min_order} min. order</span></div>
                </div>
            </div>
        </article>
        </div>
    `).join('');

    document.querySelectorAll('.restaurant-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            e.preventDefault();
            window.location.href = `menu.html?restaurant_id=${card.dataset.id}`;
        });
    });
}

// Load Categories
async function loadCategories() {
    try {
        if (DOM.categoryTabs) {
            DOM.categoryTabs.innerHTML = '';
        }
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

function syncRestaurantSearchUrl(searchTerm = '') {
    if (!DOM.restaurantSearch) return;
    const nextUrl = new URL(window.location.href);
    if (searchTerm) {
        nextUrl.searchParams.set('search', searchTerm);
    } else {
        nextUrl.searchParams.delete('search');
        nextUrl.searchParams.delete('q');
    }
    window.history.replaceState({}, '', nextUrl);
}

// Filter Restaurants
function filterRestaurants() {
    if (!window.allRestaurants) return;
    
    let filtered = [...window.allRestaurants];
    
    const searchTerm = (DOM.restaurantSearch?.value || getRestaurantSearchTermFromUrl() || '').trim();
    if (searchTerm) {
        filtered = filtered
            .map(restaurant => ({
                restaurant,
                score: scoreRestaurantMatch(restaurant, searchTerm, window.allFoods || [])
            }))
            .filter(({ score }) => score > 0)
            .sort((a, b) =>
                b.score - a.score ||
                b.restaurant.rating - a.restaurant.rating ||
                a.restaurant.name.localeCompare(b.restaurant.name)
            )
            .map(({ restaurant }) => restaurant);
    }

    syncRestaurantSearchUrl(searchTerm);
    
    const cuisine = DOM.cuisineFilter?.value || '';
    if (cuisine) {
        filtered = filtered.filter(restaurant =>
            restaurant.cuisine.toLowerCase() === cuisine.toLowerCase()
        );
    }
    
    const sortBy = DOM.sortFilter?.value || 'rating';
    if (!searchTerm || sortBy !== 'rating') {
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
    }
    
    displayRestaurants(filtered);
}

// Load Restaurant Info
async function loadRestaurantInfo(restaurantId) {
    try {
        const response = await apiCall(`/restaurants/restaurants/${restaurantId}/`);
        const restaurant = await response.json();
        if (restaurant && DOM.restaurantHeader) {
            DOM.restaurantHeader.innerHTML = `
                <img src="../assets/images/foods/${restaurant.image}" alt="${restaurant.name}">
                <div class="restaurant-header-info">
                    <h2>${restaurant.name}</h2>
                    <p><span>Free delivery for first order</span> <span><i class="fas fa-star"></i> 4.7/5 (10000+)</span></p>
                    <div class="restaurant-header-details">
                        <div class="restaurant-detail-item"><i class="fas fa-clock"></i><span>${restaurant.delivery_time} delivery</span></div>
                        <div class="restaurant-detail-item"><i class="fas fa-truck"></i><span>Delivery: Tk ${restaurant.delivery_fee}</span></div>
                        <div class="restaurant-detail-item"><i class="fas fa-shopping-bag"></i><span>Min order: Tk ${restaurant.min_order}</span></div>
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
        const [foodsResponse, restaurantResponse] = await Promise.all([
            apiCall(`/restaurants/restaurants/${restaurantId}/foods/`),
            apiCall(`/restaurants/restaurants/${restaurantId}/`)
        ]);
        const foodsData = await foodsResponse.json();
        const restaurant = await restaurantResponse.json();
        const menuItems = foodsData.results || [];
        window.currentRestaurantData = restaurant;
        const categories = [...new Set(menuItems.map(item => item.category))];

        DOM.menuCategories.innerHTML = `<div class="category-item active" data-category="all">All Items</div>${categories.map(category => `<div class="category-item" data-category="${category.toLowerCase()}">${category}</div>`).join('')}`;
        displayMenuItems(menuItems, 'all');
        setupMenuSectionSync();

        const requestedHash = window.location.hash || '';
        if (requestedHash) {
            window.setTimeout(() => scrollToMenuHash(requestedHash), 80);
        }

        document.querySelectorAll('#menu-categories .category-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('#menu-categories .category-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const category = item.dataset.category;
                if (category === 'all') {
                    DOM.menuItems.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                const section = document.querySelector(`.menu-section[data-category="${category}"]`);
                if (section) {
                    const stickyOffset = 120;
                    const top = section.getBoundingClientRect().top + window.scrollY - stickyOffset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });
        });
    } catch (error) {
        console.error('Error loading menu items:', error);
    }
}

function createFoodCardHTML(item) {
    const imagePath = item.image ? '../assets/images/foods/' + item.image : '';
    const tags = [
        item.vegetarian ? '<span class="food-tag vegetarian">Vegetarian</span>' : '',
        item.spicy_level > 1 ? '<span class="food-tag spicy">Spicy</span>' : ''
    ].filter(Boolean).join('');

    return `
        <div class="food-card" data-id="${item.id}">
            <div class="food-image">
                <img src="${imagePath}" alt="${item.name}">
            </div>
            <div class="food-info">
                <div class="food-header">
                    <h3 class="food-name">${item.name}</h3>
                    <div class="food-price">Tk ${item.price}</div>
                </div>
                <p class="food-description">${item.description || ""}</p>
                <div class="food-tags">${tags}</div>
                <div class="food-rating">
                    <i class="fas fa-star"></i>
                    <span>${item.rating ?? 4.5}</span>
                </div>
                <button class="btn btn-primary add-to-cart-btn" data-id="${item.id}">
                    <i class="fas fa-plus"></i> Add to Cart
                </button>
            </div>
        </div>
    `;
}

function attachMenuItemEvents(items) {
    document.querySelectorAll('#menu-items .add-to-cart-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const itemId = Number(button.dataset.id);
            const item = items.find(entry => Number(entry.id) === itemId);
            if (!item) {
                return;
            }
            showAddToCartModal(item, window.currentRestaurantData || null);
        });
    });
}

// Display Menu Items
function setActiveMenuCategory(category) {
    const items = document.querySelectorAll('#menu-categories .category-item');
    items.forEach(item => {
        item.classList.toggle('active', item.dataset.category === category);
    });
}

function scrollToMenuHash(hash, attempts = 10) {
    if (!hash) return;
    const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
    const target = document.getElementById(targetId);
    if (!target) {
        if (attempts > 1) {
            window.setTimeout(() => scrollToMenuHash(hash, attempts - 1), 180);
        }
        return;
    }
    const category = target.dataset.category || '';
    if (category) setActiveMenuCategory(category);
    const stickyOffset = 126;
    const top = target.getBoundingClientRect().top + window.scrollY - stickyOffset;
    window.scrollTo({ top, behavior: 'auto' });
}

function setupMenuSectionSync() {
    if (!DOM.menuCategories || !DOM.menuItems) return;
    const sections = Array.from(document.querySelectorAll('.menu-section[data-category]'));
    if (!sections.length) return;

    if (window.menuSectionScrollHandler) {
        window.removeEventListener('scroll', window.menuSectionScrollHandler);
    }

    let ticking = false;
    const updateActiveCategory = () => {
        const navOffset = 170;
        const menuTop = DOM.menuItems.getBoundingClientRect().top + window.scrollY - navOffset;
        const pageBottom = window.scrollY + window.innerHeight;
        const documentBottom = document.documentElement.scrollHeight - 24;

        if (window.scrollY < menuTop) {
            setActiveMenuCategory('all');
            ticking = false;
            return;
        }

        if (pageBottom >= documentBottom) {
            setActiveMenuCategory(sections[sections.length - 1].dataset.category);
            ticking = false;
            return;
        }

        let activeCategory = sections[0].dataset.category;
        let closestDistance = Number.POSITIVE_INFINITY;
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const distance = Math.abs(rect.top - navOffset);
            if (rect.bottom > navOffset && distance < closestDistance) {
                closestDistance = distance;
                activeCategory = section.dataset.category;
            }
        });

        setActiveMenuCategory(activeCategory);
        ticking = false;
    };

    window.menuSectionScrollHandler = () => {
        if (!ticking) {
            window.requestAnimationFrame(updateActiveCategory);
            ticking = true;
        }
    };

    window.addEventListener('scroll', window.menuSectionScrollHandler, { passive: true });
    updateActiveCategory();
}
function displayMenuItems(items, category) {
    let filteredItems = items;
    if (category !== 'all') {
        filteredItems = items.filter(item => item.category.toLowerCase() === category);
    }

    if (filteredItems.length === 0) {
        DOM.menuItems.innerHTML = `<div class="no-results"><i class="fas fa-utensils"></i><h3>No items found</h3><p>Try another category.</p></div>`;
        return;
    }

    if (category === 'all') {
        const orderedCategories = [...new Set(items.map(item => item.category))];
        DOM.menuItems.innerHTML = orderedCategories.map(sectionCategory => {
            const sectionItems = items.filter(item => item.category === sectionCategory);
            return `
                <section class="menu-section" id="menu-section-${sectionCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')}" data-category="${sectionCategory.toLowerCase()}">
                    <div class="menu-section-header"><h3 class="menu-section-title">${sectionCategory}</h3></div>
                    <div class="menu-section-grid">${sectionItems.map(item => createFoodCardHTML(item)).join('')}</div>
                </section>
            `;
        }).join('');
        attachMenuItemEvents(items);
        return;
    }

    DOM.menuItems.innerHTML = `
        <section class="menu-section single-category" id="menu-section-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}" data-category="${category}">
            <div class="menu-section-header"><h3 class="menu-section-title">${filteredItems[0].category}</h3></div>
            <div class="menu-section-grid">${filteredItems.map(item => createFoodCardHTML(item)).join('')}</div>
        </section>
    `;
    attachMenuItemEvents(filteredItems);
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
    price.textContent = `Tk ${item.price}`;
    total.textContent = `Tk ${item.price}`;
    
    // Set addons
    addonsList.innerHTML = item.addons ? item.addons.map(addon => `
        <div class="addon-item" data-price="${addon.price}">
            <div class="addon-info">
                <div class="addon-checkbox"></div>
                <span>${addon.name}</span>
            </div>
            <div class="addon-price">+Tk ${addon.price}</div>
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
        if (current < 20) {
            quantityInput.value = current + 1;
            updateModalTotal();
        }
    });

    quantityInput.addEventListener('change', () => {
        let value = parseInt(quantityInput.value);
        if (value < 1) value = 1;
        if (value > 20) value = 20;
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
    document.getElementById('modal-total-price').textContent = `Tk ${total.toFixed(2)}`;
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
function formatOrderCurrency(value) {
    return `Tk ${Number(value || 0).toFixed(2)}`;
}

function getOrderStatusTone(status) {
    const toneMap = {
        pending: 'pending',
        preparing: 'preparing',
        delivering: 'delivering',
        delivered: 'delivered',
        cancelled: 'cancelled'
    };
    return toneMap[status] || 'pending';
}

function getOrderProgressIndex(status) {
    const progressMap = {
        pending: 1,
        preparing: 2,
        delivering: 3,
        delivered: 4,
        cancelled: 1
    };
    return progressMap[status] || 1;
}

function renderOrderProgress(status) {
    const current = getOrderProgressIndex(status);
    const steps = ['Placed', 'Preparing', 'On the Way', 'Delivered'];

    return `
        <div class="progress-track">
            ${steps.map((label, index) => {
                const stepNumber = index + 1;
                const stateClass = stepNumber < current ? 'complete' : stepNumber === current ? 'active' : '';
                return `<div class="progress-step ${stateClass}">${label}</div>`;
            }).join('')}
        </div>
    `;
}

function buildOrderCardHTML(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const visibleItems = items.slice(0, 3);
    const extraItems = Math.max(0, items.length - visibleItems.length);
    const restaurantImage = order.restaurantImage || order.items?.[0]?.restaurant?.image || 'restaurant.png';
    const subtotal = order.subtotal || items.reduce((sum, item) => sum + Number(item.totalPrice || ((item.price || 0) * (item.quantity || 0))), 0);
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return `
        <article class="order-card">
            <div class="order-head">
                <div class="order-title">
                    <h3>Order #${order.id}</h3>
                    <div class="order-meta">
                        <span class="order-status ${getOrderStatusTone(order.status)}">${getStatusText(order.status)}</span>
                        <span>${order.date || ''}</span>
                        <span>${order.time || ''}</span>
                    </div>
                </div>
                <div class="order-total">${formatOrderCurrency(order.total)}</div>
            </div>

            <div class="order-restaurant-row">
                <img src="../assets/images/foods/${restaurantImage}" alt="${order.restaurant}">
                <div class="order-restaurant-copy">
                    <h4>${order.restaurant}</h4>
                    <p>${order.cuisine || 'Restaurant'}</p>
                </div>
            </div>

            <div class="order-item-list">
                <div class="order-items">
                    ${visibleItems.map(item => `
                        <div class="order-line">
                            <span>${item.quantity || 1}x ${item.name}</span>
                            <strong>${formatOrderCurrency(item.totalPrice || ((item.price || 0) * (item.quantity || 0)))}</strong>
                        </div>
                    `).join('')}
                    ${extraItems > 0 ? `<div class="order-line"><span>+${extraItems} more item${extraItems > 1 ? 's' : ''}</span><strong></strong></div>` : ''}
                </div>
            </div>

            <div class="order-mini-grid">
                <div class="order-mini-box"><span class="order-info">Items</span><strong>${itemCount}</strong></div>
                <div class="order-mini-box"><span class="order-info">Subtotal</span><strong>${formatOrderCurrency(subtotal)}</strong></div>
                <div class="order-mini-box"><span class="order-info">Payment</span><strong>${order.paymentMethod || 'cash'}</strong></div>
            </div>

            <div class="order-actions">
                <button class="btn btn-outline reorder-btn" data-order-id="${order.id}"><i class="fas fa-redo"></i> Reorder</button>
                <button class="btn btn-outline" type="button"><i class="fas fa-location-dot"></i> Details</button>
            </div>
        </article>
    `;
}

function renderActiveOrder(orders) {
    const activeShell = document.getElementById('active-order');
    if (!activeShell) {
        return;
    }

    const activeOrder = orders.find(order => ['pending', 'preparing', 'delivering'].includes(order.status));
    if (!activeOrder) {
        activeShell.innerHTML = '';
        activeShell.style.display = 'none';
        return;
    }

    const itemCount = (activeOrder.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const eta = activeOrder.items?.[0]?.restaurant?.delivery_time || '25-35 minutes';
    activeShell.style.display = 'block';
    activeShell.innerHTML = `
        <article class="active-order-card">
            <div class="order-main">
                <div class="order-top">
                    <div>
                        <span class="order-badge">Active Order</span>
                        <h3>${activeOrder.restaurant}</h3>
                    </div>
                    <span class="order-status ${getOrderStatusTone(activeOrder.status)}">${getStatusText(activeOrder.status)}</span>
                </div>
                <div class="order-item-list">
                    <div class="order-items">
                        ${(activeOrder.items || []).slice(0, 4).map(item => `
                            <div class="order-line">
                                <span>${item.quantity || 1}x ${item.name}</span>
                                <strong>${formatOrderCurrency(item.totalPrice || ((item.price || 0) * (item.quantity || 0)))}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ${renderOrderProgress(activeOrder.status)}
            </div>
            <div class="order-side">
                <div class="order-summary-box">
                    <span class="order-info">Total</span>
                    <div class="order-total">${formatOrderCurrency(activeOrder.total)}</div>
                </div>
                <div class="order-info-grid">
                    <div class="order-info-box"><span class="order-info">ETA</span><strong>${eta}</strong></div>
                    <div class="order-info-box"><span class="order-info">Items</span><strong>${itemCount}</strong></div>
                    <div class="order-info-box"><span class="order-info">Address</span><strong>${activeOrder.address || 'Saved address'}</strong></div>
                </div>
            </div>
        </article>
    `;
}

function renderOrdersCollection(orders) {
    if (!DOM.ordersList || !DOM.noOrders) {
        return;
    }

    if (!orders.length) {
        DOM.ordersList.innerHTML = '';
        DOM.noOrders.style.display = 'grid';
        return;
    }

    DOM.noOrders.style.display = 'none';
    DOM.ordersList.innerHTML = orders.map(buildOrderCardHTML).join('');

    document.querySelectorAll('.reorder-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            reorder(btn.dataset.orderId);
        });
    });
}

// Map a backend order object to the shape the render functions expect
function normalizeOrderForUI(order) {
    const restaurantInfo = order.restaurant || {};
    const createdAt = order.created_at ? new Date(order.created_at) : new Date();
    return {
        ...order,
        restaurant: restaurantInfo.name || order.restaurant || 'Unknown',
        restaurantImage: restaurantInfo.image || 'restaurant.png',
        cuisine: restaurantInfo.cuisine || 'Unknown',
        date: createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
}

async function loadOrders() {
    // If the user is not logged in, render an empty list gracefully
    if (localStorage.getItem('userLoggedIn') !== 'true') {
        renderActiveOrder([]);
        renderOrdersCollection([]);
        return;
    }

    try {
        const response = await api.getOrders();
        const orders = (response.results || []).map(normalizeOrderForUI);
        renderActiveOrder(orders);
        renderOrdersCollection(orders);
    } catch (err) {
        console.error('Failed to load orders:', err);
        renderActiveOrder([]);
        renderOrdersCollection([]);
    }
}

function getStatusText(status) {
    const statusMap = {
        pending: 'Pending',
        preparing: 'Preparing',
        delivering: 'On the Way',
        delivered: 'Delivered',
        cancelled: 'Cancelled'
    };
    return statusMap[status] || status;
}

function setupOrderTabs() {
    DOM.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterOrders(btn.dataset.status);
        });
    });
}

async function filterOrders(status) {
    if (localStorage.getItem('userLoggedIn') !== 'true') {
        renderActiveOrder([]);
        renderOrdersCollection([]);
        return;
    }

    try {
        const response = await api.getOrders();
        const allOrders = (response.results || []).map(normalizeOrderForUI);
        const visibleOrders = status === 'all' ? allOrders : allOrders.filter(order => order.status === status);
        const visibleActiveOrders = status === 'all' ? allOrders : allOrders.filter(order => ['pending', 'preparing', 'delivering'].includes(order.status) && order.status === status);
        renderActiveOrder(visibleActiveOrders);
        renderOrdersCollection(visibleOrders);
    } catch (err) {
        console.error('Failed to filter orders:', err);
    }
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
        prevBtn.style.display = currentStep > 1 && currentStep < totalSteps ? 'inline-flex' : 'none';

        if (currentStep < totalSteps - 1) {
            // Step 1: Next only
            nextBtn.style.display = 'inline-flex';
            placeOrderBtn.style.display = 'none';
            backToHomeBtn.style.display = 'none';
        } else if (currentStep === totalSteps - 1) {
            // Step 2: Place Order
            nextBtn.style.display = 'none';
            placeOrderBtn.style.display = 'inline-flex';
            backToHomeBtn.style.display = 'none';
        } else {
            // Step 3: confirmation — Back to Home only
            nextBtn.style.display = 'none';
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

            document.querySelectorAll('.co-payopt').forEach(opt => opt.classList.remove('active'));
            e.target.closest('.co-payopt')?.classList.add('active');

            cardDetails.style.display = method === 'card' ? 'block' : 'none';
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
async function placeOrder() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    if (cart.length === 0) {
        showNotification('Your cart is empty', 'error');
        return;
    }

    const restaurantInfo = cart[0]?.restaurant || {};

    // Pick up any applied global promo code from localStorage
    const appliedPromos = JSON.parse(localStorage.getItem('appliedPromos') || '[]');
    const appliedPromoCode = appliedPromos.length > 0 ? appliedPromos[0] : null;

    const payload = {
        items: cart,
        address: document.getElementById('delivery-address').value,
        paymentMethod: document.querySelector('input[name="payment"]:checked').value,
        restaurant: {
            name: restaurantInfo.name || 'Unknown',
            image: restaurantInfo.image || 'restaurant.png',
            cuisine: restaurantInfo.cuisine || 'Unknown',
            rating: restaurantInfo.rating || 4.0,
            delivery_time: restaurantInfo.delivery_time || '25-35 minutes'
        }
    };

    if (appliedPromoCode) {
        payload.promo_code = appliedPromoCode;
    }

    try {
        const order = await api.createOrder(payload);

        // Clear cart and any applied promos
        localStorage.removeItem('cart');
        localStorage.removeItem('appliedPromos');
        updateCartCount();
        localStorage.setItem('orderPlaced', 'true');

        // Update confirmation screen using server-returned authoritative totals
        document.getElementById('order-number').textContent = order.id;
        document.getElementById('confirmed-delivery-time').textContent =
            restaurantInfo.delivery_time || '25-35 minutes';

        const confirmItems = document.getElementById('confirm-items');
        confirmItems.innerHTML = (order.items || cart).map(item => `
            <div class="summary-item">
                <span>${item.quantity}x ${item.name}</span>
                <span>Tk ${Number(item.totalPrice || ((item.price || 0) * (item.quantity || 0))).toFixed(2)}</span>
            </div>
        `).join('');

        document.getElementById('confirm-total').textContent = `Tk ${Number(order.total).toFixed(2)}`;

        // Advance to the confirmation step
        document.getElementById('next-step').click();

        showNotification('Order placed successfully!', 'success');
    } catch (err) {
        console.error('Failed to place order:', err);
        showNotification(err.message || 'Failed to place order. Please try again.', 'error');
    }
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
const API_BASE_URL = window.API?.config?.BASE_URL || 'http://localhost:5000/api';
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
        credentials: 'include'
    };

    try {
        const response = await fetch(url, { ...defaultOptions, ...options });

        if (response.status === 401 && authToken) {
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












