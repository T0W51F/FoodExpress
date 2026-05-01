/* =============================================
   Super Admin Dashboard JS
   ============================================= */

const BASE_URL = (window.API && window.API.config && window.API.config.BASE_URL) || 'http://localhost:5000/api';

// ---- Auth Guard ----
function getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

function getToken() {
    return localStorage.getItem('access_token');
}

(function authGuard() {
    const user = getUser();
    if (!user || !getToken() || user.role !== 'superadmin') {
        window.location.href = 'login.html';
    }
    // Show admin name
    const u = getUser();
    if (u) {
        const nameEl = document.getElementById('sa-admin-name');
        if (nameEl) nameEl.textContent = u.firstName || u.first_name || 'Superadmin';
    }
})();

// ---- State ----
let currentApplications = [];
let currentRestaurants = [];
let currentUsers = [];
let activeAppFilter = '';
let approvingId = null;
let rejectingId = null;
let deletingRestId = null;
let banningUserId = null;
let resetPasswordUserId = null;

// ---- API ----
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
    setupFilterBtns();
    setupModals();
    setupUserSearch();
    setupPromoForm();
    setupCategoryForm();
    loadApplications();
});

function setupLogout() {
    document.getElementById('sa-logout').addEventListener('click', function () {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userLoggedIn');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}

function setupTabs() {
    document.querySelectorAll('.sa-tab-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const tab = this.dataset.tab;
            document.querySelectorAll('.sa-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.sa-tab').forEach(t => t.classList.add('hidden'));
            this.classList.add('active');
            document.getElementById(`sa-tab-${tab}`).classList.remove('hidden');

            if (tab === 'restaurants') loadRestaurants();
            if (tab === 'users') loadUsers();
            if (tab === 'analytics') loadAnalytics();
            if (tab === 'audit-log') loadAuditLog();
            if (tab === 'promotions') loadGlobalPromos();
            if (tab === 'categories') loadCategories();
        });
    });
}

function setupFilterBtns() {
    document.querySelectorAll('.sa-filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.sa-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            activeAppFilter = this.dataset.status;
            filterAndRenderApplications();
        });
    });
}

// ---- Applications ----
async function loadApplications() {
    const loading = document.getElementById('applications-loading');
    const grid = document.getElementById('applications-grid');
    const empty = document.getElementById('applications-empty');

    loading.classList.remove('hidden');
    grid.innerHTML = '';
    empty.classList.add('hidden');

    try {
        const data = await apiCall('/admin/applications');
        currentApplications = data.results || [];
        updateStats(currentApplications, currentRestaurants);
        filterAndRenderApplications();
    } catch (err) {
        grid.innerHTML = `<div style="color:#fc8181;padding:2rem">${err.message}</div>`;
    } finally {
        loading.classList.add('hidden');
    }
}

function filterAndRenderApplications() {
    const filtered = activeAppFilter
        ? currentApplications.filter(a => a.status === activeAppFilter)
        : currentApplications;

    const grid = document.getElementById('applications-grid');
    const empty = document.getElementById('applications-empty');

    if (!filtered.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = filtered.map(app => appCardHTML(app)).join('');

    grid.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => openApproveModal(Number(btn.dataset.id), btn.dataset.name));
    });

    grid.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => openRejectModal(Number(btn.dataset.id)));
    });
}

function appCardHTML(app) {
    const statusClass = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[app.status] || 'badge-pending';

    const rejectionHtml = (app.status === 'rejected' && app.rejection_reason)
        ? `<div class="sa-app-rejection-reason"><i class="fas fa-exclamation-circle"></i><span>${escHtml(app.rejection_reason)}</span></div>`
        : '';

    const actionsHtml = app.status === 'pending'
        ? `<div class="sa-app-actions">
               <button class="btn btn-success approve-btn" data-id="${app.application_id}" data-name="${escHtml(app.business_name)}">
                   <i class="fas fa-check"></i> Approve
               </button>
               <button class="btn btn-danger reject-btn" data-id="${app.application_id}">
                   <i class="fas fa-times"></i> Reject
               </button>
           </div>`
        : '';

    const descHtml = app.description
        ? `<div class="sa-app-description">${escHtml(app.description)}</div>`
        : '';

    return `
        <div class="sa-app-card" data-id="${app.application_id}">
            <div class="sa-app-card-header">
                <div>
                    <div class="sa-app-business-name">${escHtml(app.business_name)}</div>
                    <div class="sa-app-contact">${escHtml(app.contact_name)}</div>
                </div>
                <span class="sa-status-badge ${statusClass}">${app.status}</span>
            </div>
            <div class="sa-app-details">
                <div class="sa-app-detail"><i class="fas fa-envelope"></i><span>${escHtml(app.email)}</span></div>
                <div class="sa-app-detail"><i class="fas fa-phone"></i><span>${escHtml(app.phone)}</span></div>
                <div class="sa-app-detail"><i class="fas fa-map-marker-alt"></i><span>${escHtml(app.address)}</span></div>
            </div>
            ${descHtml}
            ${rejectionHtml}
            <div class="sa-app-date"><i class="fas fa-calendar"></i> Submitted ${formatDate(app.created_at)}</div>
            ${actionsHtml}
        </div>
    `;
}

// ---- Restaurants ----
async function loadRestaurants() {
    const loading = document.getElementById('restaurants-loading');
    const grid = document.getElementById('restaurants-grid');
    const empty = document.getElementById('restaurants-empty');

    loading.classList.remove('hidden');
    grid.innerHTML = '';
    empty.classList.add('hidden');

    try {
        const data = await apiCall('/admin/superadmin/restaurants');
        currentRestaurants = data.results || [];
        updateStats(currentApplications, currentRestaurants);
        renderRestaurants(currentRestaurants);
    } catch (err) {
        grid.innerHTML = `<div style="color:#fc8181;padding:2rem">${err.message}</div>`;
    } finally {
        loading.classList.add('hidden');
    }
}

function renderRestaurants(restaurants) {
    const grid = document.getElementById('restaurants-grid');
    const empty = document.getElementById('restaurants-empty');

    if (!restaurants.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = restaurants.map(r => restCardHTML(r)).join('');

    grid.querySelectorAll('.restrict-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleRestrict(Number(btn.dataset.id), btn.dataset.restricted === 'true'));
    });

    grid.querySelectorAll('.delete-rest-btn').forEach(btn => {
        btn.addEventListener('click', () => openDeleteRestModal(Number(btn.dataset.id), btn.dataset.name));
    });
}

function restCardHTML(r) {
    const isRestricted = Boolean(r.restricted);
    const statusBadge = isRestricted
        ? '<span class="sa-status-badge badge-rejected">Restricted</span>'
        : '<span class="sa-status-badge badge-approved">Active</span>';

    const imageHTML = r.image
        ? `<img src="../assets/images/foods/${r.image}" alt="${escHtml(r.name)}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-store no-image\\'></i>'">`
        : `<i class="fas fa-store no-image"></i>`;

    const restrictedOverlay = isRestricted
        ? `<div class="sa-rest-restricted-overlay"><i class="fas fa-ban"></i> Restricted</div>`
        : '';

    const restrictLabel = isRestricted ? 'Unrestrict' : 'Restrict';
    const restrictIcon = isRestricted ? 'fa-check-circle' : 'fa-ban';
    const restrictBtnClass = isRestricted ? 'btn-success' : 'btn-warning';

    return `
        <div class="sa-rest-card ${isRestricted ? 'restricted' : ''}" data-id="${r.id}">
            <div class="sa-rest-card-image">
                ${imageHTML}
                ${restrictedOverlay}
            </div>
            <div class="sa-rest-card-body">
                <div class="sa-rest-card-header">
                    <div class="sa-rest-name">${escHtml(r.name)}</div>
                    ${statusBadge}
                </div>
                <div class="sa-rest-info">
                    <div class="sa-rest-info-item"><i class="fas fa-utensils"></i><span>${escHtml(r.cuisine || 'Various')}</span></div>
                    <div class="sa-rest-info-item"><i class="fas fa-map-marker-alt"></i><span>${escHtml(r.service_area || r.contact_email || '—')}</span></div>
                    <div class="sa-rest-info-item"><i class="fas fa-star"></i><span>${Number(r.rating || 0).toFixed(1)} (${r.reviews || 0} reviews)</span></div>
                </div>
                <div class="sa-rest-actions">
                    <button class="btn ${restrictBtnClass} restrict-btn" data-id="${r.id}" data-restricted="${isRestricted}">
                        <i class="fas ${restrictIcon}"></i> ${restrictLabel}
                    </button>
                    <button class="btn btn-danger delete-rest-btn" data-id="${r.id}" data-name="${escHtml(r.name)}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function toggleRestrict(restaurantId, currentlyRestricted) {
    const newRestricted = !currentlyRestricted;
    try {
        await apiCall(`/admin/superadmin/restaurants/${restaurantId}/restrict`, {
            method: 'POST',
            body: JSON.stringify({ restricted: newRestricted })
        });
        // Patch local state and re-render
        currentRestaurants = currentRestaurants.map(r =>
            r.id === restaurantId ? { ...r, restricted: newRestricted } : r
        );
        updateStats(currentApplications, currentRestaurants);
        renderRestaurants(currentRestaurants);
    } catch (err) {
        alert('Failed: ' + err.message);
    }
}

// ---- Stats ----
function updateStats(apps, restaurants) {
    const pending = apps.filter(a => a.status === 'pending').length;
    const approved = apps.filter(a => a.status === 'approved').length;
    const restricted = restaurants.filter(r => r.restricted).length;

    document.getElementById('stat-total-restaurants').textContent = restaurants.length;
    document.getElementById('stat-pending-apps').textContent = pending;
    document.getElementById('stat-restricted').textContent = restricted;
    document.getElementById('stat-approved-apps').textContent = approved;
}

// ---- Modals ----
function setupModals() {
    // Approve
    document.getElementById('approve-modal-close').addEventListener('click', () => closeModal('approve-modal-overlay'));
    document.getElementById('approve-cancel').addEventListener('click', () => closeModal('approve-modal-overlay'));
    document.getElementById('approve-confirm').addEventListener('click', confirmApprove);

    // Reject
    document.getElementById('reject-modal-close').addEventListener('click', () => closeModal('reject-modal-overlay'));
    document.getElementById('reject-cancel').addEventListener('click', () => closeModal('reject-modal-overlay'));
    document.getElementById('reject-confirm').addEventListener('click', confirmReject);

    // Approval result
    document.getElementById('result-modal-close').addEventListener('click', () => closeModal('approval-result-overlay'));
    document.getElementById('result-close-btn').addEventListener('click', () => closeModal('approval-result-overlay'));

    // Delete restaurant
    document.getElementById('delete-rest-close').addEventListener('click', () => closeModal('delete-rest-overlay'));
    document.getElementById('delete-rest-cancel').addEventListener('click', () => closeModal('delete-rest-overlay'));
    document.getElementById('delete-rest-confirm').addEventListener('click', confirmDeleteRestaurant);

    // Ban user
    document.getElementById('ban-modal-close').addEventListener('click', () => closeModal('ban-modal-overlay'));
    document.getElementById('ban-cancel').addEventListener('click', () => closeModal('ban-modal-overlay'));
    document.getElementById('ban-confirm').addEventListener('click', confirmBanUser);

    // Reset password
    document.getElementById('reset-pw-modal-close').addEventListener('click', () => closeModal('reset-pw-modal-overlay'));
    document.getElementById('reset-pw-cancel').addEventListener('click', () => closeModal('reset-pw-modal-overlay'));
    document.getElementById('reset-pw-confirm').addEventListener('click', confirmResetPassword);

    // Toggle password visibility
    document.getElementById('reset-pw-toggle').addEventListener('click', function () {
        const input = document.getElementById('reset-pw-input');
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    });

    // Close on overlay click
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('sa-modal-overlay')) {
            e.target.classList.add('hidden');
        }
    });
}

function openApproveModal(appId, businessName) {
    approvingId = appId;
    document.getElementById('approve-business-name').textContent = businessName;
    document.getElementById('approve-confirm').disabled = false;
    document.getElementById('approve-confirm').innerHTML = '<i class="fas fa-check"></i> Approve';
    openModal('approve-modal-overlay');
}

function openRejectModal(appId) {
    rejectingId = appId;
    document.getElementById('reject-reason').value = '';
    document.getElementById('reject-error').classList.add('hidden');
    document.getElementById('reject-confirm').disabled = false;
    document.getElementById('reject-confirm').innerHTML = '<i class="fas fa-times-circle"></i> Reject Application';
    openModal('reject-modal-overlay');
}

function openDeleteRestModal(restId, restName) {
    deletingRestId = restId;
    document.getElementById('delete-rest-name').textContent = restName;
    document.getElementById('delete-rest-confirm').disabled = false;
    document.getElementById('delete-rest-confirm').innerHTML = '<i class="fas fa-trash"></i> Delete';
    openModal('delete-rest-overlay');
}

async function confirmApprove() {
    if (!approvingId) return;

    const btn = document.getElementById('approve-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Approving...';

    try {
        const result = await apiCall(`/admin/applications/${approvingId}/approve`, { method: 'POST' });
        closeModal('approve-modal-overlay');

        // Show credentials — temp_password is null when the applicant already had an account
        document.getElementById('result-email').textContent = result.user.email;
        document.getElementById('result-restaurant-id').textContent = result.restaurant.restaurant_id;

        const hasTempPassword = result.temp_password != null;
        const credBox       = document.getElementById('result-credentials-box');
        const noNewCredsMsg = document.getElementById('result-no-new-creds');
        const credWarning   = document.getElementById('result-cred-warning');

        if (hasTempPassword) {
            document.getElementById('result-password').textContent = result.temp_password;
            credBox.classList.remove('hidden');
            noNewCredsMsg.classList.add('hidden');
            credWarning.classList.remove('hidden');
        } else {
            credBox.classList.add('hidden');
            noNewCredsMsg.classList.remove('hidden');
            credWarning.classList.add('hidden');
        }

        openModal('approval-result-overlay');

        approvingId = null;
        await loadApplications();
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Approve';
        alert('Error: ' + err.message);
    }
}

async function confirmReject() {
    if (!rejectingId) return;

    const reason = document.getElementById('reject-reason').value.trim();
    const errorDiv = document.getElementById('reject-error');
    errorDiv.classList.add('hidden');

    if (!reason) {
        errorDiv.textContent = 'Please provide a rejection reason.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('reject-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rejecting...';

    try {
        await apiCall(`/admin/applications/${rejectingId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        closeModal('reject-modal-overlay');
        rejectingId = null;
        await loadApplications();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-times-circle"></i> Reject Application';
    }
}

async function confirmDeleteRestaurant() {
    if (!deletingRestId) return;

    const btn = document.getElementById('delete-rest-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        await apiCall(`/admin/superadmin/restaurants/${deletingRestId}`, { method: 'DELETE' });
        closeModal('delete-rest-overlay');
        const removedId = deletingRestId;
        deletingRestId = null;
        currentRestaurants = currentRestaurants.filter(r => r.id !== removedId);
        await loadRestaurants();
    } catch (err) {
        alert('Failed to delete: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    }
}

// ---- User Management ----
async function loadUsers(search = '') {
    const loading = document.getElementById('users-loading');
    const list = document.getElementById('users-list');
    const empty = document.getElementById('users-empty');

    loading.classList.remove('hidden');
    list.innerHTML = '';
    empty.classList.add('hidden');

    try {
        const data = await apiCall(`/admin/superadmin/users${search ? '?search=' + encodeURIComponent(search) : ''}`);
        currentUsers = data.results || [];
        renderUsers(currentUsers);
    } catch (err) {
        list.innerHTML = `<div style="color:#fc8181;padding:2rem">${escHtml(err.message)}</div>`;
    } finally {
        loading.classList.add('hidden');
    }
}

function renderUsers(users) {
    const list = document.getElementById('users-list');
    const empty = document.getElementById('users-empty');

    if (!users.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    list.innerHTML = users.map(u => userCardHTML(u)).join('');

    list.querySelectorAll('.ban-user-btn').forEach(btn => {
        btn.addEventListener('click', () => openBanModal(Number(btn.dataset.id)));
    });

    list.querySelectorAll('.unban-user-btn').forEach(btn => {
        btn.addEventListener('click', () => doUnbanUser(Number(btn.dataset.id)));
    });

    list.querySelectorAll('.reset-pw-btn').forEach(btn => {
        btn.addEventListener('click', () => openResetPasswordModal(Number(btn.dataset.id)));
    });
}

function userCardHTML(u) {
    const isSuperadmin = u.role === 'superadmin';
    const isBanned = Boolean(u.banned);

    const avatarClass = `sa-avatar-${u.role || 'customer'}`;
    const initial = (u.first_name || u.email || '?')[0].toUpperCase();
    const roleClass = `role-${u.role || 'customer'}`;
    const roleLabel = (u.role || 'customer').replace('_', ' ');

    const statusBadge = isBanned
        ? '<span class="sa-status-badge badge-rejected">Banned</span>'
        : '<span class="sa-status-badge badge-approved">Active</span>';

    const banReasonHtml = isBanned && u.ban_reason
        ? `<div class="sa-user-ban-reason"><i class="fas fa-exclamation-circle"></i><span>${escHtml(u.ban_reason)}</span></div>`
        : '';

    let actionsHtml = '';
    if (!isSuperadmin) {
        const banBtn = isBanned
            ? `<button class="btn btn-success unban-user-btn" data-id="${u.user_id}"><i class="fas fa-check-circle"></i> Unban</button>`
            : `<button class="btn btn-danger ban-user-btn" data-id="${u.user_id}"><i class="fas fa-ban"></i> Ban</button>`;

        actionsHtml = `
            <div class="sa-user-actions">
                ${banBtn}
                <button class="btn btn-warning reset-pw-btn" data-id="${u.user_id}"><i class="fas fa-key"></i> Reset Password</button>
            </div>`;
    }

    return `
        <div class="sa-user-card ${isBanned ? 'banned' : ''}" data-id="${u.user_id}">
            <div class="sa-user-card-header">
                <div class="sa-user-avatar ${avatarClass}">${initial}</div>
                <div class="sa-user-meta">
                    <div class="sa-user-name">${escHtml(u.first_name + ' ' + u.last_name)}</div>
                    <div class="sa-user-email">${escHtml(u.email)}</div>
                </div>
                <div class="sa-user-badges">
                    <span class="sa-role-badge-pill ${roleClass}">${escHtml(roleLabel)}</span>
                    ${statusBadge}
                </div>
            </div>
            <div class="sa-user-info">
                <div class="sa-user-info-item"><i class="fas fa-calendar-alt"></i><span>Joined ${formatDate(u.created_at)}</span></div>
                ${u.phone ? `<div class="sa-user-info-item"><i class="fas fa-phone"></i><span>${escHtml(u.phone)}</span></div>` : ''}
            </div>
            ${banReasonHtml}
            ${actionsHtml}
        </div>
    `;
}

function openBanModal(userId) {
    banningUserId = userId;
    document.getElementById('ban-reason-input').value = '';
    document.getElementById('ban-modal-error').classList.add('hidden');
    document.getElementById('ban-confirm').disabled = false;
    document.getElementById('ban-confirm').innerHTML = '<i class="fas fa-ban"></i> Confirm Ban';
    openModal('ban-modal-overlay');
}

function openResetPasswordModal(userId) {
    resetPasswordUserId = userId;
    const input = document.getElementById('reset-pw-input');
    input.value = '';
    input.type = 'password';
    document.getElementById('reset-pw-toggle').querySelector('i').className = 'fas fa-eye';
    document.getElementById('reset-pw-error').classList.add('hidden');
    document.getElementById('reset-pw-confirm').disabled = false;
    document.getElementById('reset-pw-confirm').innerHTML = '<i class="fas fa-key"></i> Reset Password';
    openModal('reset-pw-modal-overlay');
}

async function confirmBanUser() {
    if (!banningUserId) return;

    const reason = document.getElementById('ban-reason-input').value.trim();
    const errorDiv = document.getElementById('ban-modal-error');
    errorDiv.classList.add('hidden');

    if (!reason) {
        errorDiv.textContent = 'Please provide a ban reason.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('ban-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Banning...';

    try {
        await apiCall(`/admin/superadmin/users/${banningUserId}/ban`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        closeModal('ban-modal-overlay');
        banningUserId = null;
        showToast('User banned successfully.', 'success');
        await loadUsers(document.getElementById('user-search-input').value.trim());
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-ban"></i> Confirm Ban';
    }
}

async function doUnbanUser(userId) {
    try {
        await apiCall(`/admin/superadmin/users/${userId}/unban`, { method: 'POST' });
        showToast('User unbanned.', 'success');
        await loadUsers(document.getElementById('user-search-input').value.trim());
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

async function confirmResetPassword() {
    if (!resetPasswordUserId) return;

    const newPassword = document.getElementById('reset-pw-input').value;
    const errorDiv = document.getElementById('reset-pw-error');
    errorDiv.classList.add('hidden');

    if (!newPassword || newPassword.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const btn = document.getElementById('reset-pw-confirm');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
        await apiCall(`/admin/superadmin/users/${resetPasswordUserId}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
        closeModal('reset-pw-modal-overlay');
        resetPasswordUserId = null;
        showToast('Password reset successfully.', 'success');
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-key"></i> Reset Password';
    }
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.sa-toast');
    if (existing) existing.remove();

    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const toast = document.createElement('div');
    toast.className = `sa-toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${escHtml(message)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Search bar wiring ----
function setupUserSearch() {
    const searchBtn = document.getElementById('user-search-btn');
    const searchInput = document.getElementById('user-search-input');

    searchBtn.addEventListener('click', () => loadUsers(searchInput.value.trim()));

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') loadUsers(searchInput.value.trim());
    });
}

// ---- Platform Analytics ----
async function loadAnalytics() {
    const loading = document.getElementById('analytics-loading');
    const content = document.getElementById('analytics-content');
    const errorDiv = document.getElementById('analytics-error');
    const errorMsg = document.getElementById('analytics-error-msg');

    loading.classList.remove('hidden');
    content.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const data = await apiCall('/admin/superadmin/analytics');
        renderAnalytics(data);
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (err) {
        loading.classList.add('hidden');
        errorMsg.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

function renderAnalytics(data) {
    // Summary cards
    document.getElementById('an-total-orders').textContent = (data.total_orders || 0).toLocaleString();
    document.getElementById('an-total-revenue').textContent = Number(data.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'Tk';
    document.getElementById('an-total-users').textContent = (data.total_users || 0).toLocaleString();

    // User growth bar chart
    renderUserGrowthChart(data.user_growth || []);

    // Most popular restaurants
    renderPopularRestaurants(data.most_popular_restaurants || []);
}

function renderUserGrowthChart(growthData) {
    const container = document.getElementById('an-user-growth');
    if (!growthData.length) {
        container.innerHTML = '<div class="an-empty-note">No signup data available.</div>';
        return;
    }

    const maxCount = Math.max(...growthData.map(d => d.count), 1);

    container.innerHTML = growthData.map(item => {
        const pct = Math.round((item.count / maxCount) * 100);
        const label = formatMonthLabel(item.month);
        return `
            <div class="an-bar-row">
                <div class="an-bar-label">${escHtml(label)}</div>
                <div class="an-bar-track">
                    <div class="an-bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="an-bar-value">${item.count.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

function renderPopularRestaurants(restaurants) {
    const container = document.getElementById('an-popular-restaurants');
    if (!restaurants.length) {
        container.innerHTML = '<div class="an-empty-note">No order data available yet.</div>';
        return;
    }

    const maxOrders = Math.max(...restaurants.map(r => r.order_count), 1);

    container.innerHTML = restaurants.map((r, idx) => {
        const pct = Math.round((r.order_count / maxOrders) * 100);
        const medal = idx === 0 ? 'an-rank-gold' : idx === 1 ? 'an-rank-silver' : idx === 2 ? 'an-rank-bronze' : '';
        return `
            <div class="an-rank-row">
                <div class="an-rank-position ${medal}">${idx + 1}</div>
                <div class="an-rank-info">
                    <div class="an-rank-name">${escHtml(r.name)}</div>
                    <div class="an-rank-bar-track">
                        <div class="an-rank-bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>
                <div class="an-rank-count">${r.order_count.toLocaleString()} orders</div>
            </div>
        `;
    }).join('');
}

function formatMonthLabel(yearMonth) {
    // yearMonth is "YYYY-MM"
    const [year, month] = yearMonth.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ---- Audit Log ----
const ACTION_LABELS = {
    approve_application:   'Approved Application',
    reject_application:    'Rejected Application',
    ban_user:              'Banned User',
    unban_user:            'Unbanned User',
    reset_password:        'Reset Password',
    restrict_restaurant:   'Restricted Restaurant',
    unrestrict_restaurant: 'Unrestricted Restaurant',
    delete_restaurant:     'Deleted Restaurant',
    create_global_promo:   'Created Global Promo',
    delete_global_promo:   'Deleted Global Promo',
    create_category:       'Created Category',
    delete_category:       'Deleted Category'
};

const ACTION_SEVERITY = {
    approve_application:   'success',
    reject_application:    'danger',
    ban_user:              'danger',
    unban_user:            'success',
    reset_password:        'warning',
    restrict_restaurant:   'danger',
    unrestrict_restaurant: 'success',
    delete_restaurant:     'danger',
    create_global_promo:   'success',
    delete_global_promo:   'danger',
    create_category:       'success',
    delete_category:       'danger'
};

async function loadAuditLog() {
    const loading = document.getElementById('audit-log-loading');
    const tableWrap = document.getElementById('audit-log-table-wrap');
    const empty = document.getElementById('audit-log-empty');
    const errorDiv = document.getElementById('audit-log-error');
    const errorMsg = document.getElementById('audit-log-error-msg');

    loading.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    empty.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const data = await apiCall('/admin/superadmin/audit-log?limit=100');
        loading.classList.add('hidden');

        const logs = data.results || [];
        if (!logs.length) {
            empty.classList.remove('hidden');
            return;
        }

        const tbody = document.getElementById('audit-log-tbody');
        tbody.innerHTML = logs.map(log => auditLogRowHTML(log)).join('');
        tableWrap.classList.remove('hidden');
    } catch (err) {
        loading.classList.add('hidden');
        errorMsg.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

function auditLogRowHTML(log) {
    const label = ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const severity = ACTION_SEVERITY[log.action] || 'neutral';
    const targetText = log.target_id
        ? `${log.target_type || 'item'} #${log.target_id}`
        : '—';

    return `
        <tr>
            <td class="al-cell-date">${formatDateTime(log.created_at)}</td>
            <td class="al-cell-actor">
                <div class="al-actor-name">${escHtml(log.actor_name)}</div>
                <div class="al-actor-email">${escHtml(log.actor_email)}</div>
            </td>
            <td><span class="al-action-badge al-badge-${severity}">${escHtml(label)}</span></td>
            <td class="al-cell-target">${escHtml(targetText)}</td>
            <td class="al-cell-note">${escHtml(log.note || '—')}</td>
        </tr>
    `;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
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

// ---- Global Promotions ----

let currentPromos = [];

function setupPromoForm() {
    const form = document.getElementById('gp-create-form');
    if (!form) return;
    form.addEventListener('submit', submitCreatePromo);
}

async function loadGlobalPromos() {
    const loading = document.getElementById('gp-loading');
    const tableWrap = document.getElementById('gp-table-wrap');
    const empty = document.getElementById('gp-empty');
    const errorDiv = document.getElementById('gp-error');
    const errorMsg = document.getElementById('gp-error-msg');

    loading.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    empty.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const data = await apiCall('/admin/superadmin/promotions');
        loading.classList.add('hidden');
        currentPromos = data.results || [];

        if (!currentPromos.length) {
            empty.classList.remove('hidden');
            return;
        }

        const tbody = document.getElementById('gp-tbody');
        tbody.innerHTML = currentPromos.map(p => promoRowHTML(p)).join('');
        tableWrap.classList.remove('hidden');
        attachPromoActions();
    } catch (err) {
        loading.classList.add('hidden');
        errorMsg.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

function promoRowHTML(p) {
    const typeLabel = p.type === 'percentage' ? '%' : 'Tk';
    const valueDisplay = p.type === 'percentage' ? `${p.value}%` : `Tk ${p.value}`;
    const minOrderDisplay = p.min_order !== null ? `Tk ${p.min_order}` : '—';
    const usesDisplay = p.max_uses !== null ? `${p.uses} / ${p.max_uses}` : `${p.uses} / ∞`;
    const expiresDisplay = p.expires_at ? formatDate(p.expires_at) : '—';

    const now = new Date();
    const isExpired = p.expires_at && new Date(p.expires_at) < now;
    const isCapped = p.max_uses !== null && p.uses >= p.max_uses;
    let statusBadge;
    if (isExpired) {
        statusBadge = '<span class="gp-badge gp-badge-expired">Expired</span>';
    } else if (isCapped) {
        statusBadge = '<span class="gp-badge gp-badge-capped">Cap Reached</span>';
    } else if (p.active) {
        statusBadge = '<span class="gp-badge gp-badge-active">Active</span>';
    } else {
        statusBadge = '<span class="gp-badge gp-badge-inactive">Inactive</span>';
    }

    const toggleLabel = p.active ? 'Deactivate' : 'Activate';
    const toggleIcon = p.active ? 'fa-toggle-off' : 'fa-toggle-on';

    return `
        <tr>
            <td><code class="gp-code-chip">${escHtml(p.code)}</code></td>
            <td>${escHtml(p.type === 'percentage' ? 'Percentage' : 'Flat')}</td>
            <td>${escHtml(valueDisplay)}</td>
            <td>${escHtml(minOrderDisplay)}</td>
            <td>${escHtml(usesDisplay)}</td>
            <td>${escHtml(expiresDisplay)}</td>
            <td>${statusBadge}</td>
            <td class="gp-actions">
                <button class="btn btn-sm btn-outline gp-toggle-btn" data-id="${p.promo_id}" title="${toggleLabel}">
                    <i class="fas ${toggleIcon}"></i> ${escHtml(toggleLabel)}
                </button>
                <button class="btn btn-sm btn-danger gp-delete-btn" data-id="${p.promo_id}" data-code="${escHtml(p.code)}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

function attachPromoActions() {
    document.querySelectorAll('.gp-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => handleTogglePromo(Number(btn.dataset.id)));
    });
    document.querySelectorAll('.gp-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeletePromo(Number(btn.dataset.id), btn.dataset.code));
    });
}

async function submitCreatePromo(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('gp-form-error');
    errorDiv.classList.add('hidden');

    const code = document.getElementById('gp-code').value.trim().toUpperCase();
    const type = document.getElementById('gp-type').value;
    const value = document.getElementById('gp-value').value;
    const minOrder = document.getElementById('gp-min-order').value;
    const maxUses = document.getElementById('gp-max-uses').value;
    const expiresAt = document.getElementById('gp-expires').value;

    if (!code) {
        showFormError('Code is required.');
        return;
    }
    if (!value || isNaN(Number(value)) || Number(value) < 0) {
        showFormError('Discount value must be a non-negative number.');
        return;
    }
    if (type === 'percentage' && Number(value) > 100) {
        showFormError('Percentage value cannot exceed 100.');
        return;
    }

    const submitBtn = document.getElementById('gp-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        await apiCall('/admin/superadmin/promotions', {
            method: 'POST',
            body: JSON.stringify({
                code,
                type,
                value: Number(value),
                min_order: minOrder ? Number(minOrder) : null,
                max_uses: maxUses ? Number(maxUses) : null,
                expires_at: expiresAt || null
            })
        });
        document.getElementById('gp-create-form').reset();
        await loadGlobalPromos();
    } catch (err) {
        showFormError(err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Code';
    }
}

function showFormError(msg) {
    const errorDiv = document.getElementById('gp-form-error');
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
}

async function handleTogglePromo(id) {
    try {
        await apiCall(`/admin/superadmin/promotions/${id}/toggle`, { method: 'PATCH' });
        await loadGlobalPromos();
    } catch (err) {
        alert(`Failed to toggle promo: ${err.message}`);
    }
}

async function handleDeletePromo(id, code) {
    if (!confirm(`Delete promo code "${code}"? This cannot be undone.`)) return;
    try {
        await apiCall(`/admin/superadmin/promotions/${id}`, { method: 'DELETE' });
        await loadGlobalPromos();
    } catch (err) {
        alert(`Failed to delete promo: ${err.message}`);
    }
}

// ---- Categories ----

let currentCategories = [];

function setupCategoryForm() {
    const form = document.getElementById('cat-create-form');
    if (!form) return;
    form.addEventListener('submit', submitCreateCategory);
}

async function loadCategories() {
    const loading = document.getElementById('cat-loading');
    const tableWrap = document.getElementById('cat-table-wrap');
    const empty = document.getElementById('cat-empty');
    const errorDiv = document.getElementById('cat-error');
    const errorMsg = document.getElementById('cat-error-msg');

    loading.classList.remove('hidden');
    tableWrap.classList.add('hidden');
    empty.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const data = await apiCall('/admin/superadmin/categories');
        loading.classList.add('hidden');
        currentCategories = data.results || [];

        if (!currentCategories.length) {
            empty.classList.remove('hidden');
            return;
        }

        const tbody = document.getElementById('cat-tbody');
        tbody.innerHTML = currentCategories.map(c => categoryRowHTML(c)).join('');
        tableWrap.classList.remove('hidden');
        attachCategoryActions();
    } catch (err) {
        loading.classList.add('hidden');
        errorMsg.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
}

function categoryRowHTML(c) {
    const statusBadge = c.active
        ? '<span class="cat-badge cat-badge-active">Active</span>'
        : '<span class="cat-badge cat-badge-inactive">Inactive</span>';

    const toggleLabel = c.active ? 'Deactivate' : 'Activate';
    const toggleIcon  = c.active ? 'fa-toggle-off' : 'fa-toggle-on';
    const foodsLabel  = c.foods_count === 1 ? '1 food' : `${c.foods_count} foods`;

    return `
        <tr data-id="${c.category_id}">
            <td class="cat-cell-name">${escHtml(c.name)}</td>
            <td><code class="cat-slug-chip">${escHtml(c.slug)}</code></td>
            <td class="cat-cell-count">${escHtml(foodsLabel)}</td>
            <td>${statusBadge}</td>
            <td class="cat-actions">
                <button class="btn btn-sm btn-outline cat-rename-btn" data-id="${c.category_id}" data-name="${escHtml(c.name)}" title="Rename">
                    <i class="fas fa-pencil-alt"></i> Rename
                </button>
                <button class="btn btn-sm btn-outline cat-toggle-btn" data-id="${c.category_id}" title="${escHtml(toggleLabel)}">
                    <i class="fas ${toggleIcon}"></i> ${escHtml(toggleLabel)}
                </button>
                <button class="btn btn-sm btn-danger cat-delete-btn" data-id="${c.category_id}" data-name="${escHtml(c.name)}" data-count="${c.foods_count}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

function attachCategoryActions() {
    document.querySelectorAll('.cat-rename-btn').forEach(btn => {
        btn.addEventListener('click', () => handleRenameCategory(Number(btn.dataset.id), btn.dataset.name));
    });
    document.querySelectorAll('.cat-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => handleToggleCategory(Number(btn.dataset.id)));
    });
    document.querySelectorAll('.cat-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeleteCategory(Number(btn.dataset.id), btn.dataset.name, Number(btn.dataset.count)));
    });
}

async function submitCreateCategory(e) {
    e.preventDefault();
    const errorDiv = document.getElementById('cat-form-error');
    errorDiv.classList.add('hidden');

    const name = document.getElementById('cat-name').value.trim();
    if (!name) {
        errorDiv.textContent = 'Category name is required.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const submitBtn = document.getElementById('cat-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
        await apiCall('/admin/superadmin/categories', {
            method: 'POST',
            body: JSON.stringify({ name })
        });
        document.getElementById('cat-create-form').reset();
        await loadCategories();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Category';
    }
}

async function handleRenameCategory(id, currentName) {
    const newName = prompt(`Rename category "${currentName}" to:`, currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    try {
        await apiCall(`/admin/superadmin/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: newName.trim() })
        });
        await loadCategories();
    } catch (err) {
        alert(`Failed to rename category: ${err.message}`);
    }
}

async function handleToggleCategory(id) {
    try {
        await apiCall(`/admin/superadmin/categories/${id}/toggle`, { method: 'PATCH' });
        await loadCategories();
    } catch (err) {
        alert(`Failed to toggle category: ${err.message}`);
    }
}

async function handleDeleteCategory(id, name, foodsCount) {
    if (foodsCount > 0) {
        alert(`Cannot delete "${name}" — it is used by ${foodsCount} food item(s). Reassign those foods first.`);
        return;
    }
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    try {
        await apiCall(`/admin/superadmin/categories/${id}`, { method: 'DELETE' });
        await loadCategories();
    } catch (err) {
        alert(`Failed to delete category: ${err.message}`);
    }
}
