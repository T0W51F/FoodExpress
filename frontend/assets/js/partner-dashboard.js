/* =============================================
   Partner Dashboard — Restaurant Admin JS
   ============================================= */

const BASE_URL = (window.API && window.API.config && window.API.config.BASE_URL) || 'http://localhost:5000/api';

// ---- Auth Guard ----
function getUser() {
    const raw = localStorage.getItem('user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function getToken() {
    return localStorage.getItem('access_token');
}

(function authGuard() {
    const user = getUser();
    if (!user || !getToken() || user.role !== 'restaurant_admin') {
        window.location.href = 'login.html';
    }
})();

// ---- State ----
let currentFoods = [];
let editingFoodId = null;
let deletingFoodId = null;

// ---- API helpers ----
async function apiCall(endpoint, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json', ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

    if (res.status === 401) {
        localStorage.clear();
        window.location.href = 'login.html';
        throw new Error('Session expired');
    }

    if (res.status === 204) return null;

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
    return data;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', function () {
    setupLogout();
    setupTabs();
    setupFoodModal();
    setupDeleteModal();
    setupProfileForm();
    loadDashboard();
});

function setupLogout() {
    document.getElementById('pd-logout').addEventListener('click', function () {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}

function setupTabs() {
    document.querySelectorAll('.pd-nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', function () {
            const tab = this.dataset.tab;
            switchTab(tab);
            if (tab === 'orders')     loadOrders();
            if (tab === 'deliveries') loadDrivers();
            if (tab === 'promotions') loadPromos();
            if (tab === 'customers')  loadCustomers();
            if (tab === 'analytics')  loadAnalytics();
            if (tab === 'payments')   loadPayments();
        });
    });
}

function switchTab(tab) {
    document.querySelectorAll('.pd-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pd-tab').forEach(t => t.classList.add('hidden'));

    const activeBtn = document.querySelector(`.pd-nav-item[data-tab="${tab}"]`);
    const activeTab = document.getElementById(`tab-${tab}`);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeTab) activeTab.classList.remove('hidden');
}

// ---- Dashboard Load ----
async function loadDashboard() {
    const loading = document.getElementById('pd-loading');
    const errorDiv = document.getElementById('pd-error');

    loading.style.display = 'flex';
    errorDiv.classList.add('hidden');

    // Hide all tabs
    document.querySelectorAll('.pd-tab').forEach(t => t.classList.add('hidden'));

    try {
        const data = await apiCall('/restaurant/dashboard');

        // Update restaurant name in header
        document.getElementById('pd-restaurant-name').textContent = data.restaurant.name;

        // Update sidebar stats
        document.getElementById('stat-foods').textContent = data.stats.total_foods;
        document.getElementById('stat-orders').textContent = data.stats.total_orders;
        document.getElementById('stat-revenue').textContent = `${data.stats.total_revenue.toFixed(2)}Tk`;
        document.getElementById('stat-status').textContent = data.restaurant.is_open ? 'Open' : 'Closed';
        document.getElementById('stat-status').style.color = data.restaurant.is_open ? '#00b894' : '#ff7675';

        document.getElementById('stat-active-orders').textContent = data.stats.active_orders || 0;

        // Active orders badge
        const activeBadge = document.getElementById('active-orders-badge');
        if (data.stats.active_orders > 0) {
            activeBadge.textContent = data.stats.active_orders;
            activeBadge.style.display = 'inline-block';
        }

        // Load foods
        await loadFoods();

        // Pre-fill profile form
        prefillProfileForm(data.restaurant);

        loading.style.display = 'none';
        await loadOverviewContent(data);
        switchTab('overview');
    } catch (err) {
        loading.style.display = 'none';
        document.getElementById('pd-error-msg').textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

async function loadOverviewContent(dashData) {
    // Stat cards
    const grid = document.getElementById('overview-grid');
    const stats = dashData.stats;
    grid.innerHTML = `
        <div class="overview-stat-card">
            <div class="osc-value">${stats.total_orders}</div>
            <div class="osc-label">Total Orders</div>
        </div>
        <div class="overview-stat-card">
            <div class="osc-value">${Number(stats.total_revenue).toFixed(2)}Tk</div>
            <div class="osc-label">Revenue</div>
        </div>
        <div class="overview-stat-card accent">
            <div class="osc-value">${stats.active_orders || 0}</div>
            <div class="osc-label">Active Orders</div>
        </div>
        <div class="overview-stat-card">
            <div class="osc-value">${stats.total_foods}</div>
            <div class="osc-label">Menu Items</div>
        </div>
    `;

    // Recent orders
    try {
        const ordersData = await apiCall('/restaurant/orders');
        const recent = (ordersData.results || []).slice(0, 8);
        const recentEl = document.getElementById('overview-recent-orders');
        if (!recent.length) {
            recentEl.innerHTML = '<p style="color:rgba(239,243,247,0.3);font-size:0.85rem">No orders yet.</p>';
        } else {
            recentEl.innerHTML = recent.map(o => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
                    <span style="font-size:0.8rem;color:#94a3b8;font-family:monospace">#${o.order_id}</span>
                    <span style="font-size:0.8rem;color:#e2e8f0">${Number(o.total||0).toFixed(2)}Tk</span>
                    <span class="order-status-badge status-${o.status}">${o.status}</span>
                </div>
            `).join('');
        }
    } catch (_) { /* non-fatal */ }

    // Popular items via analytics
    try {
        const analyticsData = await apiCall('/restaurant/analytics');
        const popular = (analyticsData.popular_items || []).slice(0, 5);
        const popEl = document.getElementById('overview-popular-items');
        if (!popular.length) {
            popEl.innerHTML = '<p style="color:rgba(239,243,247,0.3);font-size:0.85rem">No data yet.</p>';
        } else {
            popEl.innerHTML = popular.map(item => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05)">
                    <span style="font-size:0.85rem;color:#e2e8f0">${escHtml(item.name)}</span>
                    <span style="font-size:0.8rem;color:#64748b">${item.qty} sold</span>
                </div>
            `).join('');
        }
    } catch (_) { /* non-fatal */ }
}

// ---- Foods ----
async function loadFoods() {
    const data = await apiCall('/restaurant/foods');
    currentFoods = data.results || [];
    renderFoods(currentFoods);
}

function renderFoods(foods) {
    const grid = document.getElementById('foods-grid');
    const empty = document.getElementById('foods-empty');

    if (!foods.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = foods.map(food => foodCardHTML(food)).join('');

    grid.querySelectorAll('.food-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => openEditFoodModal(Number(btn.dataset.id)));
    });

    grid.querySelectorAll('.food-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteModal(Number(btn.dataset.id), btn.dataset.name));
    });
}

function resolveFoodImageSrc(image) {
    if (!image) return null;
    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) return image;
    return `../assets/images/foods/${image}`;
}

function foodCardHTML(food) {
    const imageSrc = resolveFoodImageSrc(food.image);
    const imageHTML = imageSrc
        ? `<img src="${imageSrc}" alt="${escHtml(food.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-utensils no-image\\'></i>'">`
        : `<i class="fas fa-utensils no-image"></i>`;

    const tags = [
        food.vegetarian ? '<span class="tag tag-vegetarian">Vegetarian</span>' : '',
        food.popular    ? '<span class="tag tag-popular">Popular</span>'       : ''
    ].filter(Boolean).join('');

    return `
        <div class="food-card" data-id="${food.food_id}">
            <div class="food-card-image">${imageHTML}</div>
            <div class="food-card-body">
                <div class="food-card-name">${escHtml(food.name)}</div>
                <div class="food-card-meta">
                    <span class="food-card-category">${escHtml(food.category || 'Uncategorized')}</span>
                    <span class="food-card-price">${Number(food.price).toFixed(2)}Tk</span>
                </div>
                ${food.description ? `<p class="food-card-description">${escHtml(food.description)}</p>` : ''}
                ${tags ? `<div class="food-card-tags">${tags}</div>` : ''}
                <div class="food-card-actions">
                    <button class="btn btn-outline food-edit-btn" data-id="${food.food_id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger food-delete-btn" data-id="${food.food_id}" data-name="${escHtml(food.name)}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ---- Category Dropdown ----
async function populateCategoryDropdown(selectedCategoryId, fallbackName = '') {
    const select = document.getElementById('food-category');
    select.innerHTML = '<option value="">-- Loading categories... --</option>';

    try {
        const data = await fetch(`${BASE_URL}/restaurants/categories/`).then(r => r.json());
        const categories = data.results || [];

        select.innerHTML = '<option value="">-- Select a category --</option>';

        if (categories.length === 0) {
            // No managed categories defined — offer a free-text fallback
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- No categories defined yet --';
            opt.disabled = true;
            select.appendChild(opt);
        } else {
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.category_id;
                opt.dataset.id = cat.category_id;
                opt.dataset.name = cat.name;
                opt.textContent = cat.name;
                if (selectedCategoryId !== null && cat.category_id === selectedCategoryId) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });

            // If editing a food with a legacy category string but no category_id, try to match by name
            if (selectedCategoryId === null && fallbackName) {
                for (const opt of select.options) {
                    if (opt.dataset.name && opt.dataset.name.toLowerCase() === fallbackName.toLowerCase()) {
                        opt.selected = true;
                        break;
                    }
                }
            }
        }
    } catch {
        select.innerHTML = '<option value="">-- Could not load categories --</option>';
    }
}

// ---- Food Modal Add-ons ----
function renderAddonRows(addons) {
    const list = document.getElementById('addons-list');
    list.innerHTML = '';
    (addons || []).forEach(addon => addAddonRow(addon.name, addon.price));
}

function addAddonRow(name = '', price = '') {
    const list = document.getElementById('addons-list');
    const row = document.createElement('div');
    row.className = 'addon-row';
    row.innerHTML = `
        <input type="text" class="addon-name" placeholder="Add-on name" value="${escHtml(String(name))}">
        <input type="number" class="addon-price" placeholder="Price" min="0" step="0.01" value="${price !== '' ? Number(price) : ''}">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.addon-row').remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    list.appendChild(row);
}

function collectAddons() {
    const rows = document.querySelectorAll('#addons-list .addon-row');
    const addons = [];
    rows.forEach(row => {
        const name = row.querySelector('.addon-name').value.trim();
        const price = parseFloat(row.querySelector('.addon-price').value);
        if (name && !isNaN(price) && price >= 0) {
            addons.push({ name, price });
        }
    });
    return addons;
}

// ---- Food Modal (Add / Edit) ----
function setupFoodModal() {
    document.getElementById('add-food-btn').addEventListener('click', openAddFoodModal);
    document.getElementById('food-modal-close').addEventListener('click', closeFoodModal);
    document.getElementById('food-modal-cancel').addEventListener('click', closeFoodModal);
    document.getElementById('food-modal-save').addEventListener('click', saveFoodItem);
    document.getElementById('food-form').addEventListener('submit', function (e) {
        e.preventDefault();
        saveFoodItem();
    });
    document.getElementById('food-image-file').addEventListener('change', handleImageFilePick);
    document.getElementById('food-image').addEventListener('input', syncImagePreviewFromText);
    document.getElementById('add-addon-btn').addEventListener('click', () => addAddonRow());
}

async function handleImageFilePick(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (ev) {
        const dataUrl = ev.target.result;
        const fileName = file.name;

        // Show local preview immediately
        setImagePreview(dataUrl);

        const saveBtn = document.getElementById('food-modal-save');
        const origText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Uploading…';

        try {
            const result = await apiCall('/restaurant/uploads/menu-image', {
                method: 'POST',
                body: JSON.stringify({ filename: fileName, data: dataUrl })
            });
            document.getElementById('food-image').value = result.image_url;
        } catch (err) {
            alert('Image upload failed: ' + err.message);
            setImagePreview(null);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        }
    };
    reader.readAsDataURL(file);
}

function syncImagePreviewFromText() {
    const val = document.getElementById('food-image').value.trim();
    if (!val) { setImagePreview(null); return; }
    setImagePreview(resolveFoodImageSrc(val));
}

function setImagePreview(src) {
    const wrap = document.getElementById('food-image-preview-wrap');
    const img = document.getElementById('food-image-preview');
    if (!src) {
        wrap.classList.add('hidden');
        img.src = '';
    } else {
        img.src = src;
        wrap.classList.remove('hidden');
    }
}

async function openAddFoodModal() {
    editingFoodId = null;
    document.getElementById('food-modal-title').textContent = 'Add Food Item';
    document.getElementById('food-form').reset();
    document.getElementById('food-id').value = '';
    document.getElementById('food-image-file').value = '';
    setImagePreview(null);
    renderAddonRows([]);
    document.getElementById('food-form-error').classList.add('hidden');
    await populateCategoryDropdown(null);
    openModal('food-modal-overlay');
}

async function openEditFoodModal(foodId) {
    const food = currentFoods.find(f => f.food_id === foodId);
    if (!food) return;

    editingFoodId = foodId;
    document.getElementById('food-modal-title').textContent = 'Edit Food Item';
    document.getElementById('food-id').value = food.food_id;
    document.getElementById('food-name').value = food.name || '';
    document.getElementById('food-description').value = food.description || '';
    document.getElementById('food-price').value = food.price || '';
    document.getElementById('food-spicy').value = food.spicy_level || 0;
    document.getElementById('food-image').value = food.image || '';
    document.getElementById('food-image-file').value = '';
    setImagePreview(resolveFoodImageSrc(food.image));
    renderAddonRows(food.addons || []);
    document.getElementById('food-vegetarian').checked = Boolean(food.vegetarian);
    document.getElementById('food-popular').checked = Boolean(food.popular);
    document.getElementById('food-form-error').classList.add('hidden');
    await populateCategoryDropdown(food.category_id ?? null, food.category || '');
    openModal('food-modal-overlay');
}

function closeFoodModal() {
    closeModal('food-modal-overlay');
}

async function saveFoodItem() {
    const errorDiv = document.getElementById('food-form-error');
    errorDiv.classList.add('hidden');

    const name = document.getElementById('food-name').value.trim();
    const price = document.getElementById('food-price').value;

    if (!name) {
        showModalError(errorDiv, 'Food name is required.');
        return;
    }
    if (!price || Number(price) <= 0) {
        showModalError(errorDiv, 'A valid price is required.');
        return;
    }

    const categorySelect = document.getElementById('food-category');
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];
    const selectedCategoryName = selectedOption ? (selectedOption.dataset.name || selectedOption.value || '') : '';
    const selectedCategoryId = selectedOption && selectedOption.dataset.id ? Number(selectedOption.dataset.id) : null;

    const data = {
        name,
        category: selectedCategoryName,
        category_id: selectedCategoryId,
        description: document.getElementById('food-description').value.trim(),
        price: Number(price),
        spicy_level: Number(document.getElementById('food-spicy').value || 0),
        image: document.getElementById('food-image').value.trim(),
        vegetarian: document.getElementById('food-vegetarian').checked,
        popular: document.getElementById('food-popular').checked,
        addons: collectAddons()
    };

    const saveBtn = document.getElementById('food-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        if (editingFoodId) {
            await apiCall(`/restaurant/foods/${editingFoodId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            await apiCall('/restaurant/foods', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        closeFoodModal();
        await loadFoods();

        // Refresh stat
        const foodCount = currentFoods.length;
        document.getElementById('stat-foods').textContent = foodCount;
    } catch (err) {
        showModalError(errorDiv, err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
}

// ---- Delete Modal ----
function setupDeleteModal() {
    document.getElementById('delete-modal-close').addEventListener('click', () => closeModal('delete-modal-overlay'));
    document.getElementById('delete-cancel').addEventListener('click', () => closeModal('delete-modal-overlay'));
    document.getElementById('delete-confirm').addEventListener('click', confirmDelete);
}

function openDeleteModal(foodId, foodName) {
    deletingFoodId = foodId;
    document.getElementById('delete-food-name').textContent = foodName;
    openModal('delete-modal-overlay');
}

async function confirmDelete() {
    if (!deletingFoodId) return;

    const btn = document.getElementById('delete-confirm');
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        await apiCall(`/restaurant/foods/${deletingFoodId}`, { method: 'DELETE' });
        closeModal('delete-modal-overlay');
        deletingFoodId = null;
        await loadFoods();
        document.getElementById('stat-foods').textContent = currentFoods.length;
    } catch (err) {
        alert('Failed to delete: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    }
}

// ---- Orders ----
async function loadOrders() {
    const tbody = document.getElementById('orders-tbody');
    const empty = document.getElementById('orders-empty');
    const table = document.getElementById('orders-table');

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:2rem;">Loading...</td></tr>';
    table.classList.remove('hidden');
    empty.classList.add('hidden');

    try {
        const data = await apiCall('/restaurant/orders');
        const orders = data.results || [];

        document.getElementById('stat-orders').textContent = orders.length;

        if (!orders.length) {
            table.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }

        const TERMINAL = ['delivered', 'cancelled'];
        const ALL_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

        tbody.innerHTML = orders.map(order => {
            const isTerminal = TERMINAL.includes(order.status);
            const statusOptions = ALL_STATUSES.map(s =>
                `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.replace(/_/g,' ')}</option>`
            ).join('');

            return `
                <tr data-order-id="${order.order_id}">
                    <td style="font-family:monospace;font-size:0.8rem;color:#94a3b8">#${order.order_id}</td>
                    <td>${order.items.length} item${order.items.length !== 1 ? 's' : ''}</td>
                    <td style="font-weight:600;color:#f1f5f9">${Number(order.total || 0).toFixed(2)}Tk</td>
                    <td style="text-transform:capitalize">${order.paymentMethod || 'cash'}</td>
                    <td>
                        <select class="order-status-select status-${order.status}" data-order-id="${order.order_id}" ${isTerminal ? 'disabled' : ''}>
                            ${statusOptions}
                        </select>
                    </td>
                    <td style="color:#64748b;font-size:0.8rem">${formatDate(order.created_at)}</td>
                    <td>
                        ${!isTerminal ? `<button class="btn btn-danger btn-sm cancel-order-btn" data-order-id="${order.order_id}" style="font-size:0.75rem;padding:0.3rem 0.6rem">Cancel</button>` : '<span style="color:#475569;font-size:0.75rem">—</span>'}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.order-status-select').forEach(sel => {
            sel.addEventListener('change', async function () {
                const orderId = this.dataset.orderId;
                const newStatus = this.value;
                this.disabled = true;
                try {
                    await apiCall(`/restaurant/orders/${orderId}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: newStatus })
                    });
                    this.className = `order-status-select status-${newStatus}`;
                    if (['delivered','cancelled'].includes(newStatus)) {
                        this.disabled = true;
                        const cancelBtn = tbody.querySelector(`.cancel-order-btn[data-order-id="${orderId}"]`);
                        if (cancelBtn) cancelBtn.remove();
                    } else {
                        this.disabled = false;
                    }
                } catch (err) {
                    alert('Failed to update status: ' + err.message);
                    this.disabled = false;
                    await loadOrders();
                }
            });
        });

        tbody.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', async function () {
                if (!confirm('Cancel this order?')) return;
                const orderId = this.dataset.orderId;
                this.disabled = true;
                try {
                    await apiCall(`/restaurant/orders/${orderId}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'cancelled' })
                    });
                    await loadOrders();
                } catch (err) {
                    alert('Failed to cancel: ' + err.message);
                    this.disabled = false;
                }
            });
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#fc8181;padding:2rem;">${err.message}</td></tr>`;
    }
}

// ---- Profile Form ----
function prefillProfileForm(restaurant) {
    document.getElementById('prof-name').value = restaurant.name || '';
    document.getElementById('prof-cuisine').value = restaurant.cuisine || '';
    document.getElementById('prof-delivery-time').value = restaurant.delivery_time || '';
    document.getElementById('prof-operating-hours').value = restaurant.operating_hours || '';
    document.getElementById('prof-delivery-fee').value = restaurant.delivery_fee ?? '';
    document.getElementById('prof-min-order').value = restaurant.min_order ?? '';
    document.getElementById('prof-address').value = restaurant.service_area || '';
    document.getElementById('prof-description').value = restaurant.description || '';
    document.getElementById('prof-phone').value = restaurant.contact_phone || '';
    document.getElementById('prof-email').value = restaurant.contact_email || '';
    document.getElementById('prof-image').value = restaurant.image || '';
    document.getElementById('prof-is-open').checked = Boolean(restaurant.is_open);
}

function setupProfileForm() {
    document.getElementById('profile-form').addEventListener('submit', async function (e) {
        e.preventDefault();

        const errorDiv = document.getElementById('profile-error');
        const successDiv = document.getElementById('profile-success');
        const saveBtn = document.getElementById('profile-save-btn');

        errorDiv.classList.add('hidden');
        successDiv.classList.add('hidden');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const data = {
            name: document.getElementById('prof-name').value.trim(),
            cuisine: document.getElementById('prof-cuisine').value.trim(),
            delivery_time: document.getElementById('prof-delivery-time').value.trim(),
            operating_hours: document.getElementById('prof-operating-hours').value.trim(),
            delivery_fee: Number(document.getElementById('prof-delivery-fee').value),
            min_order: Number(document.getElementById('prof-min-order').value),
            service_area: document.getElementById('prof-address').value.trim(),
            description: document.getElementById('prof-description').value.trim(),
            contact_phone: document.getElementById('prof-phone').value.trim(),
            contact_email: document.getElementById('prof-email').value.trim(),
            image: document.getElementById('prof-image').value.trim(),
            is_open: document.getElementById('prof-is-open').checked
        };

        try {
            const updated = await apiCall('/restaurant/profile', {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            document.getElementById('pd-restaurant-name').textContent = updated.name;
            document.getElementById('stat-status').textContent = updated.is_open ? 'Open' : 'Closed';
            document.getElementById('stat-status').style.color = updated.is_open ? '#00b894' : '#ff7675';

            successDiv.classList.remove('hidden');
            setTimeout(() => successDiv.classList.add('hidden'), 3000);
        } catch (err) {
            errorDiv.textContent = err.message;
            errorDiv.classList.remove('hidden');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    });
}

// ---- Utilities ----
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
}

function showModalError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
}

function escHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    });
}

// ---- Stubs for tabs implemented in later tasks ----
async function loadDrivers() {}
async function loadPromos() {}
async function loadCustomers() {}
async function loadAnalytics() {}
async function loadPayments() {}

// Close modals on overlay click
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('pd-modal-overlay')) {
        e.target.classList.add('hidden');
        document.body.style.overflow = '';
    }
});
