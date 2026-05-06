// API Configuration
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_CONFIG = {
    BASE_URL: isLocal ? 'http://localhost:5000/api' : 'https://foodexpress-f7j4.onrender.com/api',
    TIMEOUT: 60000,
    HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// API Service
class APIService {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
        this.timeout = API_CONFIG.TIMEOUT;
        this.headers = API_CONFIG.HEADERS;
    }
    
    getAccessToken() {
        return localStorage.getItem('access_token');
    }

    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    async request(endpoint, options = {}, _isRetry = false) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const config = {
                credentials: 'include',
                ...options,
                headers: { ...this.headers, ...options.headers },
                signal: controller.signal
            };

            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            if (response.status === 401 && !_isRetry) {
                // Attempt to refresh the access token using the stored refresh token.
                const refreshToken = this.getRefreshToken();
                if (refreshToken) {
                    try {
                        const refreshResponse = await fetch(`${this.baseUrl}/auth/token/refresh/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                            body: JSON.stringify({ refresh: refreshToken })
                        });

                        if (refreshResponse.ok) {
                            const refreshData = await refreshResponse.json();
                            localStorage.setItem('access_token', refreshData.access);

                            // Rebuild the Authorization header with the new token and retry once.
                            const retryOptions = {
                                ...options,
                                headers: {
                                    ...options.headers,
                                    'Authorization': `Bearer ${refreshData.access}`
                                }
                            };
                            return await this.request(endpoint, retryOptions, true);
                        }
                    } catch (_refreshError) {
                        // Refresh request itself failed — fall through to clear + redirect.
                    }
                }

                // Refresh failed or no refresh token available — clear session and redirect.
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('userLoggedIn');
                const _currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const _safeNext = ['login.html', 'register.html', 'index.html'].includes(_currentPage)
                    ? null : _currentPage;
                window.location.href = _safeNext
                    ? `login.html?next=${encodeURIComponent(_safeNext)}`
                    : 'login.html';
                return Promise.reject(new Error('Session expired'));
            }

            if (response.status === 403 && !_isRetry) {
                // Check if account has been banned
                try {
                    const body = await response.clone().json();
                    if (body.error === 'Account banned') {
                        localStorage.clear();
                        window.location.href = 'login.html?banned=1';
                        return Promise.reject(new Error('Account banned'));
                    }
                } catch (_e) {
                    // Not a JSON body or not the banned error — fall through
                }
            }

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || Object.values(errorData)[0]?.[0] || errorMessage;
                } catch (parseError) {
                }

                throw new Error(errorMessage);
            }

            if (response.status === 204) return null;
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Request timeout. Please try again.');
            }

            throw error;
        }
    }
    
    // Authentication
    async login(email, password) {
        return await this.request('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }
    
    async register(userData) {
        return await this.request('/auth/register/', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }
    
    async logout() {
        return await this.request('/auth/logout/', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify({ refresh: this.getRefreshToken() })
        });
    }
    
    // Restaurants
    async getRestaurants(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/restaurants/restaurants/?${queryString}`);
    }
    
    async getRestaurant(id) {
        return await this.request(`/restaurants/restaurants/${id}/`);
    }
    
    // Menu Items
    async getMenuItems(restaurantId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/restaurants/restaurants/${restaurantId}/foods/?${queryString}`);
    }
    
    async getFoodItem(id) {
        return await this.request(`/restaurants/foods/${id}/`);
    }
    
    // Orders
    async getOrders(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return await this.request(`/orders/orders/?${queryString}`, {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }
    
    async createOrder(orderData) {
        return await this.request('/orders/orders/', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(orderData)
        });
    }
    
    async getOrder(id) {
        return await this.request(`/orders/orders/${id}/`, {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async deleteOrder(id) {
        return await this.request(`/orders/orders/${id}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }
    
    // Cart (local storage for Phase 1, will be replaced with API in Phase 3)
    async syncCart(cartData) {
        return await this.request('/orders/cart/', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(cartData)
        });
    }
    
    // Reviews
    async createReview(reviewData) {
        return await this.request('/restaurants/reviews/', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(reviewData)
        });
    }

    async submitOrderReviews(orderId, reviews) {
        return await this.request(`/orders/orders/${orderId}/reviews/`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify({ reviews })
        });
    }

    // User Profile
    async getProfile() {
        return await this.request('/auth/profile/', {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }
    
    async updateProfile(profileData) {
        return await this.request('/auth/profile/update/', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(profileData)
        });
    }
    
    // Search
    async search(query, params = {}) {
        const queryString = new URLSearchParams({ q: query, ...params }).toString();
        return await this.request(`/restaurants/search/?${queryString}`);
    }

    // Partner Application (requires auth)
    async submitPartnerApplication(data) {
        return await this.request('/partner/apply', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(data)
        });
    }

    async getApplicationStatus(email) {
        return await this.request(`/partner/status/${encodeURIComponent(email)}`);
    }

    // Restaurant Admin — own restaurant
    async getRestaurantDashboard() {
        return await this.request('/restaurant/dashboard', {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async getRestaurantAdminFoods() {
        return await this.request('/restaurant/foods', {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async createRestaurantFood(data) {
        return await this.request('/restaurant/foods', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(data)
        });
    }

    async updateRestaurantFood(foodId, data) {
        return await this.request(`/restaurant/foods/${foodId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(data)
        });
    }

    async deleteRestaurantFood(foodId) {
        return await this.request(`/restaurant/foods/${foodId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async getRestaurantAdminOrders() {
        return await this.request('/restaurant/orders', {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async updateRestaurantProfile(data) {
        return await this.request('/restaurant/profile', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify(data)
        });
    }

    // Superadmin — applications
    async listApplications(status) {
        const qs = status ? `?status=${encodeURIComponent(status)}` : '';
        return await this.request(`/admin/applications${qs}`, {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async getApplication(id) {
        return await this.request(`/admin/applications/${id}`, {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async approveApplication(id) {
        return await this.request(`/admin/applications/${id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async rejectApplication(id, reason) {
        return await this.request(`/admin/applications/${id}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify({ reason })
        });
    }

    // Superadmin — restaurants
    async listAllRestaurantsAdmin() {
        return await this.request('/admin/superadmin/restaurants', {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async restrictRestaurant(id, restricted) {
        return await this.request(`/admin/superadmin/restaurants/${id}/restrict`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify({ restricted })
        });
    }

    async deleteRestaurantAdmin(id) {
        return await this.request(`/admin/superadmin/restaurants/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    // Superadmin — user management
    async listUsers(search = '') {
        const qs = search ? `?search=${encodeURIComponent(search)}` : '';
        return await this.request(`/admin/superadmin/users${qs}`, {
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async banUser(id, reason) {
        return await this.request(`/admin/superadmin/users/${id}/ban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify({ reason })
        });
    }

    async unbanUser(id) {
        return await this.request(`/admin/superadmin/users/${id}/unban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` }
        });
    }

    async resetUserPassword(id, newPassword) {
        return await this.request(`/admin/superadmin/users/${id}/reset-password`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.getAccessToken()}` },
            body: JSON.stringify({ newPassword })
        });
    }
}

// Create API instance
const api = new APIService();

// Local Storage Simulation (Phase 1)
class LocalStorageService {
    // Restaurants
    async getRestaurants() {
        const response = await fetch('../data/restaurants.json');
        return await response.json();
    }
    
    // Foods
    async getFoods() {
        const response = await fetch('../data/foods.json');
        return await response.json();
    }
    
    // Simulate API calls with delay
    simulateRequest(data, delay = 500) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    success: true,
                    data,
                    timestamp: new Date().toISOString()
                });
            }, delay);
        });
    }
}

// Create localStorage service instance
const localStorageService = new LocalStorageService();

// Phase 1/3 Switch
const isPhase1 = false; // Set to false when backend is ready

// Export appropriate service
const dataService = isPhase1 ? localStorageService : api;

// Helper Functions
function handleAPIError(error) {
    console.error('API Error:', error);
    
    // Show user-friendly error message
    const message = error.message || 'An error occurred. Please try again.';
    showNotification(message, 'error');
    
    // Check for authentication errors
    if (error.message.includes('401') || error.message.includes('403')) {
        // Clear invalid token
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userLoggedIn');

        // Redirect to login, preserving the current page as ?next=
        setTimeout(() => {
            const _currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const _safeNext = ['login.html', 'register.html', 'index.html'].includes(_currentPage)
                ? null : _currentPage;
            window.location.href = _safeNext
                ? `login.html?next=${encodeURIComponent(_safeNext)}`
                : 'login.html';
        }, 2000);
    }
}

// Request Interceptor (Phase 3)
function addAuthHeader(config) {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers = {
            ...config.headers,
            'Authorization': `Bearer ${token}`
        };
    }
    return config;
}

// Response Interceptor (Phase 3)
function handleResponse(response) {
    if (response.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userLoggedIn');
        window.location.href = 'login.html';
        return Promise.reject(new Error('Session expired'));
    }
    
    if (!response.ok) {
        return response.json().then(data => {
            throw new Error(data.error || 'An error occurred');
        });
    }
    
    return response.json();
}

// Mock Data for Phase 1
const mockData = {
    restaurants: [],
    foods: [],
    
    async loadData() {
        try {
            const [restaurantsRes, foodsRes] = await Promise.all([
                fetch('../data/restaurants.json'),
                fetch('../data/foods.json')
            ]);
            
            this.restaurants = await restaurantsRes.json();
            this.foods = await foodsRes.json();
        } catch (error) {
            console.error('Error loading mock data:', error);
        }
    },
    
    // Simulate API endpoints
    async get(endpoint, params = {}) {
        await this.loadData();
        
        switch (endpoint) {
            case '/restaurants/':
                return this.simulateRequest(this.restaurants);
                
            case '/foods/':
                return this.simulateRequest(this.foods);
                
            case '/restaurants/{id}/menu/':
                const restaurantId = params.restaurantId || 1;
                const menuItems = this.foods.foods.filter(f => f.restaurant_id == restaurantId);
                return this.simulateRequest(menuItems);
                
            default:
                return this.simulateRequest({});
        }
    },
    
    async post(endpoint, data) {
        switch (endpoint) {
            case '/auth/login/':
                // Simulate login
                return this.simulateRequest({
                    token: 'mock-jwt-token',
                    user: {
                        id: 1,
                        email: data.email,
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                });
                
            case '/orders/':
                // Simulate order creation
                const orderId = 'ORD' + Date.now().toString().slice(-8);
                return this.simulateRequest({
                    id: orderId,
                    status: 'pending',
                    ...data
                });
                
            default:
                return this.simulateRequest({ success: true });
        }
    }
};

// Initialize mock data
if (isPhase1) {
    mockData.loadData();
}

// Export
window.API = {
    service: dataService,
    mock: mockData,
    isPhase1,
    config: API_CONFIG
};

// Usage Example:
/*
// Get restaurants
API.service.getRestaurants().then(data => {
    console.log('Restaurants:', data);
}).catch(error => {
    handleAPIError(error);
});

// Create order
API.service.createOrder(orderData).then(response => {
    console.log('Order created:', response);
}).catch(error => {
    handleAPIError(error);
});
*/

