# Partner Dashboard Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace admin.html with a fully-featured partner-dashboard for every restaurant, giving Pizzaburg, Peyari Tehari, and Milano Express a unified per-restaurant management UI with grouped sidebar, order status controls, food add-ons, delivery management, promotions, customers, analytics, and payments.

**Architecture:** Extend `partner-dashboard.html/js/css` in-place with a grouped sidebar and 5 new tabs. Add matching routes to `backend/src/routes/restaurant-admin.js` (mirroring and scoping admin.js logic). Fix seed roles so Pizzaburg/Peyari Tehari accounts use `restaurant_admin` not `admin`. Delete only the 3 frontend admin files — keep backend `admin.js` intact (superadmin routes still live there).

**Tech Stack:** Express.js routes, Mongoose, Vanilla JS, Font Awesome icons, existing partner-dashboard CSS custom properties.

---

## File Map

**Modified:**
- `backend/src/routes/restaurant-admin.js` — new routes: order status, deliveries CRUD, promotions CRUD, customers, analytics, payments
- `backend/src/data/store.js` — new function: `getRestaurantAnalytics(restaurant_id)`
- `backend/src/scripts/seed.js` — change Pizzaburg/Peyari Tehari role from `'admin'` to `'restaurant_admin'`
- `frontend/pages/partner-dashboard.html` — grouped sidebar + overview, deliveries, promotions, customers, analytics, payments tab shells; orders table Actions column; food modal add-ons section
- `frontend/assets/css/partner-dashboard.css` — `.pd-nav-group-label`, `.addon-row`, `.overview-grid`, `.pd-form-two-col`, `.pd-table-wrap`
- `frontend/assets/js/partner-dashboard.js` — all new tab JS, add-ons modal, order status controls

**Deleted:**
- `frontend/pages/admin.html`
- `frontend/assets/js/admin.js`
- `frontend/assets/css/admin.css`

**Not touched:**
- `backend/src/routes/admin.js` — keep; superadmin routes still needed by superadmin.html
- `backend/src/models/Food.js` — addons field already exists
- `backend/src/utils/formatters.js` — serializeFood already spreads addons

---

## Task 1: Backend — Order status route

**Files:**
- Modify: `backend/src/routes/restaurant-admin.js`

- [ ] **Step 1: Add the updateDeliveryWorkload helper and PATCH /orders/:id/status route**

  Open `backend/src/routes/restaurant-admin.js`. Add these imports at the top (after the existing imports):

  ```js
  import { Order, DeliveryPerson } from '../models/index.js';
  ```

  Then add this helper function and route before `export default router;`:

  ```js
  async function updateDeliveryWorkload(deliveryPersonId, { activeDelta = 0, completedDelta = 0 } = {}) {
    if (!deliveryPersonId) return;
    const person = await DeliveryPerson.findOne({ delivery_person_id: Number(deliveryPersonId) });
    if (!person) return;
    const nextActive = Math.max(0, Number(person.active_orders || 0) + activeDelta);
    const nextCompleted = Math.max(0, Number(person.completed_deliveries || 0) + completedDelta);
    await DeliveryPerson.updateOne(
      { delivery_person_id: Number(deliveryPersonId) },
      { active_orders: nextActive, completed_deliveries: nextCompleted, status: nextActive > 0 ? 'busy' : 'available' }
    );
  }

  // PATCH /api/restaurant/orders/:id/status
  router.patch('/orders/:id/status', async (req, res, next) => {
    try {
      const restaurantId = getRestaurantId(req);
      const existing = await Order.findOne({ order_id: req.params.id }).lean();
      if (!existing) return res.status(404).json({ detail: 'Order not found' });
      if (existing.restaurant?.id !== restaurantId) {
        return res.status(403).json({ detail: 'Order belongs to a different restaurant' });
      }

      const terminal = ['delivered', 'cancelled'];
      if (terminal.includes(existing.status)) {
        return res.status(400).json({ detail: `Order is already ${existing.status}` });
      }

      const nextStatus = req.body.status;
      const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
      if (!validStatuses.includes(nextStatus)) {
        return res.status(400).json({ detail: `Invalid status: ${nextStatus}` });
      }

      const updates = { status: nextStatus };
      if (nextStatus === 'cancelled' && req.body.cancellation_reason) {
        updates.cancellation_reason = req.body.cancellation_reason;
      }
      if (nextStatus === 'delivered') {
        updates.delivered_at = new Date();
        updates.paymentStatus = 'paid';
      }

      const updated = await Order.findOneAndUpdate({ order_id: req.params.id }, updates, { new: true }).lean();

      if (existing.assigned_delivery_person_id && existing.status === 'out_for_delivery' && nextStatus !== 'out_for_delivery') {
        await updateDeliveryWorkload(existing.assigned_delivery_person_id, {
          activeDelta: -1,
          completedDelta: nextStatus === 'delivered' ? 1 : 0
        });
      }

      res.json({ order_id: updated.order_id, status: updated.status });
    } catch (error) {
      next(error);
    }
  });
  ```

- [ ] **Step 2: Verify**

  ```bash
  cd backend && npm run dev
  ```

  Expected: server starts, no import errors.

  In another terminal:
  ```bash
  # Login as Pizzaburg admin to get a token (after Task 5 updates the role)
  # For now just confirm the server loads cleanly
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/routes/restaurant-admin.js
  git commit -m "feat(restaurant-admin): add order status update route"
  ```

---

## Task 2: Backend — Delivery personnel routes

**Files:**
- Modify: `backend/src/routes/restaurant-admin.js`

- [ ] **Step 1: Add Promotion and DeliveryPerson model imports (if not already added in Task 1)**

  Ensure the import line at the top of `restaurant-admin.js` reads:
  ```js
  import { Order, DeliveryPerson, Promotion } from '../models/index.js';
  ```

  Also ensure `getNextSequence` is imported:
  ```js
  import { getNextSequence } from '../utils/counters.js';
  ```

- [ ] **Step 2: Add delivery personnel routes before `export default router;`**

  ```js
  // GET /api/restaurant/deliveries
  router.get('/deliveries', async (_req, res, next) => {
    try {
      const people = await DeliveryPerson.find().sort({ delivery_person_id: 1 }).lean();
      res.json({ count: people.length, results: people });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/restaurant/deliveries
  router.post('/deliveries', async (req, res, next) => {
    try {
      const created = await DeliveryPerson.create({
        delivery_person_id: await getNextSequence('delivery_people'),
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        zone: req.body.zone || 'Dhaka',
        status: req.body.status || 'available',
        completed_deliveries: Number(req.body.completed_deliveries || 0),
        active_orders: Number(req.body.active_orders || 0),
        rating: Number(req.body.rating || 4.8)
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/restaurant/deliveries/:id
  router.put('/deliveries/:id', async (req, res, next) => {
    try {
      const patch = {};
      const fields = ['name', 'phone', 'email', 'zone', 'status', 'rating'];
      fields.forEach(f => { if (req.body[f] !== undefined) patch[f] = req.body[f]; });
      if (req.body.completed_deliveries !== undefined) patch.completed_deliveries = Number(req.body.completed_deliveries);
      if (req.body.active_orders !== undefined) patch.active_orders = Number(req.body.active_orders);
      if (req.body.rating !== undefined) patch.rating = Number(req.body.rating);

      const updated = await DeliveryPerson.findOneAndUpdate(
        { delivery_person_id: Number(req.params.id) }, patch, { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ detail: 'Delivery person not found' });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/restaurant/deliveries/:id
  router.delete('/deliveries/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const active = await Order.findOne({
        assigned_delivery_person_id: id,
        status: { $in: ['pending', 'confirmed', 'preparing', 'out_for_delivery'] }
      }).lean();
      if (active) return res.status(400).json({ detail: 'This driver has an active order' });

      const deleted = await DeliveryPerson.findOneAndDelete({ delivery_person_id: id }).lean();
      if (!deleted) return res.status(404).json({ detail: 'Delivery person not found' });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add backend/src/routes/restaurant-admin.js
  git commit -m "feat(restaurant-admin): add delivery personnel CRUD routes"
  ```

---

## Task 3: Backend — Promotions routes

**Files:**
- Modify: `backend/src/routes/restaurant-admin.js`

- [ ] **Step 1: Add promotions routes before `export default router;`**

  ```js
  // GET /api/restaurant/promotions
  router.get('/promotions', async (_req, res, next) => {
    try {
      const promos = await Promotion.find().sort({ createdAt: -1 }).lean();
      res.json({ count: promos.length, results: promos });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/restaurant/promotions
  router.post('/promotions', async (req, res, next) => {
    try {
      const created = await Promotion.create({
        promotion_id: await getNextSequence('promotions'),
        code: String(req.body.code || '').toUpperCase(),
        title: req.body.title,
        description: req.body.description || '',
        discount_type: req.body.discount_type || 'percentage',
        discount_value: Number(req.body.discount_value || 0),
        active: req.body.active !== undefined ? Boolean(req.body.active) : true,
        starts_at: req.body.starts_at || new Date(),
        ends_at: req.body.ends_at || null,
        usage_count: 0
      });
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/restaurant/promotions/:id
  router.put('/promotions/:id', async (req, res, next) => {
    try {
      const patch = {};
      if (req.body.code !== undefined) patch.code = String(req.body.code).toUpperCase();
      if (req.body.title !== undefined) patch.title = req.body.title;
      if (req.body.description !== undefined) patch.description = req.body.description;
      if (req.body.discount_type !== undefined) patch.discount_type = req.body.discount_type;
      if (req.body.discount_value !== undefined) patch.discount_value = Number(req.body.discount_value);
      if (req.body.active !== undefined) patch.active = Boolean(req.body.active);
      if (req.body.ends_at !== undefined) patch.ends_at = req.body.ends_at;

      const updated = await Promotion.findOneAndUpdate(
        { promotion_id: Number(req.params.id) }, patch, { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ detail: 'Promotion not found' });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/restaurant/promotions/:id
  router.delete('/promotions/:id', async (req, res, next) => {
    try {
      const deleted = await Promotion.findOneAndDelete({ promotion_id: Number(req.params.id) }).lean();
      if (!deleted) return res.status(404).json({ detail: 'Promotion not found' });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add backend/src/routes/restaurant-admin.js
  git commit -m "feat(restaurant-admin): add promotions CRUD routes"
  ```

---

## Task 4: Backend — Customers, Analytics, Payments routes

**Files:**
- Modify: `backend/src/routes/restaurant-admin.js`
- Modify: `backend/src/data/store.js`

- [ ] **Step 1: Add `getRestaurantAnalytics` to `store.js`**

  Add this function at the end of `backend/src/data/store.js`, before the final export if any:

  ```js
  export async function getRestaurantAnalytics(restaurant_id) {
    const orders = await Order.find({ 'restaurant.id': Number(restaurant_id) }).lean();
    const nonCancelled = orders.filter(o => o.status !== 'cancelled');
    const totalRevenue = nonCancelled.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const avgOrderValue = nonCancelled.length ? totalRevenue / nonCancelled.length : 0;

    const itemMap = new Map();
    nonCancelled.forEach(order => {
      (order.items || []).forEach(item => {
        const key = String(item.id || item.name);
        const entry = itemMap.get(key) || { name: item.name, category: item.category || '', qty: 0, revenue: 0 };
        entry.qty += Number(item.quantity || 0);
        entry.revenue += Number(item.totalPrice || (item.price || 0) * (item.quantity || 0));
        itemMap.set(key, entry);
      });
    });

    const popularItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

    const categoryMap = new Map();
    nonCancelled.forEach(order => {
      (order.items || []).forEach(item => {
        const cat = item.category || 'Uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(item.quantity || 0));
      });
    });
    const topCategory = [...categoryMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    return {
      total_orders: orders.length,
      total_revenue: Number(totalRevenue.toFixed(2)),
      avg_order_value: Number(avgOrderValue.toFixed(2)),
      top_category: topCategory,
      popular_items: popularItems
    };
  }
  ```

  Also add the `Order` model import at the top of store.js if not already present (it already is at line ~12).

- [ ] **Step 2: Add the three read routes to `restaurant-admin.js`**

  Add to the imports at the top of `restaurant-admin.js`:
  ```js
  import { ..., getRestaurantAnalytics } from '../data/store.js';
  ```
  (Add `getRestaurantAnalytics` to the existing destructured import list.)

  Also add `User, Review` to the models import:
  ```js
  import { Order, DeliveryPerson, Promotion, User, Review } from '../models/index.js';
  ```

  Then add before `export default router;`:

  ```js
  // GET /api/restaurant/customers
  router.get('/customers', async (req, res, next) => {
    try {
      const restaurantId = getRestaurantId(req);
      const orders = await Order.find({ 'restaurant.id': restaurantId }).lean();
      const userIds = [...new Set(orders.map(o => o.user_id))];
      const users = await User.find({ user_id: { $in: userIds } }).lean();
      const userMap = new Map(users.map(u => [u.user_id, u]));

      const results = userIds.map(uid => {
        const user = userMap.get(uid);
        const userOrders = orders.filter(o => o.user_id === uid);
        const totalSpent = userOrders
          .filter(o => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total || 0), 0);
        return {
          id: uid,
          name: user ? `${user.first_name} ${user.last_name}`.trim() : `User ${uid}`,
          email: user?.email || '',
          order_count: userOrders.length,
          total_spent: Number(totalSpent.toFixed(2)),
          joined_at: user?.createdAt || null
        };
      });

      res.json({ count: results.length, results });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/restaurant/analytics
  router.get('/analytics', async (req, res, next) => {
    try {
      const restaurantId = getRestaurantId(req);
      const data = await getRestaurantAnalytics(restaurantId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/restaurant/payments
  router.get('/payments', async (req, res, next) => {
    try {
      const restaurantId = getRestaurantId(req);
      const orders = await Order.find({ 'restaurant.id': restaurantId }).sort({ createdAt: -1 }).lean();
      const results = orders.map(o => ({
        order_id: o.order_id,
        amount: Number(o.total || 0),
        method: o.paymentMethod || 'cash',
        gateway: o.paymentGateway || 'Cash on Delivery',
        status: o.paymentStatus || 'pending',
        created_at: o.createdAt
      }));
      res.json({ count: results.length, results });
    } catch (error) {
      next(error);
    }
  });
  ```

- [ ] **Step 3: Restart backend and smoke-test**

  ```bash
  cd backend && npm run dev
  ```

  Expected: server starts cleanly. No "cannot find module" errors.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/routes/restaurant-admin.js backend/src/data/store.js
  git commit -m "feat(restaurant-admin): add customers, analytics, payments routes"
  ```

---

## Task 5: Seed — Fix restaurant admin roles

**Files:**
- Modify: `backend/src/data/store.js` (inside `seedAdminBootstrapData`)

The seed creates Pizzaburg and Peyari Tehari admin accounts with `role: 'admin'`. These need to be `role: 'restaurant_admin'` so `requireRestaurantAdmin` middleware admits them.

- [ ] **Step 1: Change the role in `seedAdminBootstrapData`**

  In `backend/src/data/store.js`, find the `restaurantAdmins` block inside `seedAdminBootstrapData` (around line 1455). Change `role: 'admin'` to `role: 'restaurant_admin'`:

  ```js
  // BEFORE:
  role: 'admin',

  // AFTER:
  role: 'restaurant_admin',
  ```

  The full `create` call in the loop should read:
  ```js
  await User.create({
    user_id: await getNextSequence('users'),
    first_name: ra.first_name,
    last_name: ra.last_name,
    email: ra.email,
    phone: ra.phone,
    password_hash: adminPasswordHash,
    role: 'restaurant_admin',
    restaurant_id: ra.restaurant_id,
    status: 'active'
  });
  ```

- [ ] **Step 2: Patch existing accounts in DB**

  The seed is idempotent but only creates users that don't exist. Existing accounts won't be updated. Run this one-time fix in the backend directory:

  ```bash
  cd backend
  node -e "
  import('./src/database.js').then(async () => {
    const { User } = await import('./src/models/index.js');
    const result = await User.updateMany(
      { email: { \$in: ['admin@pizzaburg.com', 'admin@peyaritehari.com'] } },
      { \$set: { role: 'restaurant_admin' } }
    );
    console.log('Updated:', result.modifiedCount, 'users');
    process.exit(0);
  });
  "
  ```

  Expected output: `Updated: 2 users`

  > If those emails don't exist yet (fresh DB), re-run `npm run seed` after this task to create them with the correct role.

- [ ] **Step 3: Verify login works**

  Start the backend (`npm run dev`). POST to `http://localhost:5000/api/auth/login` with `{ "email": "admin@pizzaburg.com", "password": "Admin123!" }`. Confirm the JWT payload contains `role: "restaurant_admin"` and `restaurant_id: 1`.

- [ ] **Step 4: Commit**

  ```bash
  git add backend/src/data/store.js
  git commit -m "fix(seed): change Pizzaburg/Peyari Tehari admin accounts to restaurant_admin role"
  ```

---

## Task 6: Frontend — Grouped sidebar + new tab shells (HTML + CSS)

**Files:**
- Modify: `frontend/pages/partner-dashboard.html`
- Modify: `frontend/assets/css/partner-dashboard.css`

- [ ] **Step 1: Replace the `<nav class="pd-nav">` block in `partner-dashboard.html`**

  Find and replace the entire `<nav class="pd-nav">...</nav>` block:

  ```html
  <nav class="pd-nav">
      <!-- Overview -->
      <button class="pd-nav-item active" data-tab="overview">
          <i class="fas fa-chart-pie"></i>
          <span>Overview</span>
      </button>

      <!-- Restaurant group -->
      <div class="pd-nav-group-label">Restaurant</div>
      <button class="pd-nav-item" data-tab="menu">
          <i class="fas fa-utensils"></i>
          <span>Menu</span>
      </button>
      <button class="pd-nav-item" data-tab="profile">
          <i class="fas fa-edit"></i>
          <span>Profile</span>
      </button>

      <!-- Operations group -->
      <div class="pd-nav-group-label">Operations</div>
      <button class="pd-nav-item" data-tab="orders">
          <i class="fas fa-receipt"></i>
          <span>Orders</span>
          <span class="pd-badge" id="active-orders-badge" style="display:none"></span>
      </button>
      <button class="pd-nav-item" data-tab="deliveries">
          <i class="fas fa-motorcycle"></i>
          <span>Deliveries</span>
      </button>

      <!-- Business group -->
      <div class="pd-nav-group-label">Business</div>
      <button class="pd-nav-item" data-tab="promotions">
          <i class="fas fa-tags"></i>
          <span>Promotions</span>
      </button>
      <button class="pd-nav-item" data-tab="customers">
          <i class="fas fa-users"></i>
          <span>Customers</span>
      </button>
      <button class="pd-nav-item" data-tab="analytics">
          <i class="fas fa-chart-line"></i>
          <span>Analytics</span>
      </button>
      <button class="pd-nav-item" data-tab="payments">
          <i class="fas fa-credit-card"></i>
          <span>Payments</span>
      </button>
  </nav>
  ```

- [ ] **Step 2: Add Active Orders row to the stats sidebar**

  Find `<div class="pd-stats-sidebar">`. After the existing `stat-revenue` item and before the closing `</div>`, add:

  ```html
  <div class="pd-stat-item">
      <span class="pd-stat-label">Active Orders</span>
      <span class="pd-stat-value" id="stat-active-orders" style="color:#ff8558">—</span>
  </div>
  ```

- [ ] **Step 3: Add tab shell divs for all new tabs**

  After the closing `</div>` of `tab-profile` and before the `</main>` tag, add:

  ```html
  <!-- ===== Overview Tab ===== -->
  <div id="tab-overview" class="pd-tab hidden">
      <div class="pd-tab-header">
          <div>
              <h2>Overview</h2>
              <p class="pd-tab-subtitle">Your restaurant at a glance.</p>
          </div>
      </div>
      <div class="overview-grid" id="overview-grid"></div>
      <div class="overview-sections">
          <div class="pd-panel">
              <h3 class="pd-panel-title">Recent Orders</h3>
              <div id="overview-recent-orders"></div>
          </div>
          <div class="pd-panel">
              <h3 class="pd-panel-title">Popular Items This Week</h3>
              <div id="overview-popular-items"></div>
          </div>
      </div>
  </div>

  <!-- ===== Deliveries Tab ===== -->
  <div id="tab-deliveries" class="pd-tab hidden">
      <div class="pd-tab-header">
          <div>
              <h2>Delivery Personnel</h2>
              <p class="pd-tab-subtitle">Manage your shared driver pool.</p>
          </div>
          <button class="btn btn-primary" id="add-driver-btn">
              <i class="fas fa-plus"></i> Add Driver
          </button>
      </div>
      <div class="pd-table-wrap">
          <table class="pd-orders-table" id="drivers-table">
              <thead>
                  <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Zone</th>
                      <th>Status</th>
                      <th>Rating</th>
                      <th>Actions</th>
                  </tr>
              </thead>
              <tbody id="drivers-tbody"></tbody>
          </table>
      </div>
      <div id="drivers-empty" class="pd-empty hidden">
          <i class="fas fa-motorcycle"></i>
          <h3>No drivers yet</h3>
          <p>Add your first driver to get started.</p>
      </div>
  </div>

  <!-- ===== Promotions Tab ===== -->
  <div id="tab-promotions" class="pd-tab hidden">
      <div class="pd-tab-header">
          <div>
              <h2>Promotions</h2>
              <p class="pd-tab-subtitle">Manage discount codes and campaigns.</p>
          </div>
          <button class="btn btn-primary" id="add-promo-btn">
              <i class="fas fa-plus"></i> Add Promotion
          </button>
      </div>
      <div class="pd-table-wrap">
          <table class="pd-orders-table" id="promos-table">
              <thead>
                  <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Active</th>
                      <th>Actions</th>
                  </tr>
              </thead>
              <tbody id="promos-tbody"></tbody>
          </table>
      </div>
      <div id="promos-empty" class="pd-empty hidden">
          <i class="fas fa-tags"></i>
          <h3>No promotions yet</h3>
          <p>Create your first discount code.</p>
      </div>
  </div>

  <!-- ===== Customers Tab ===== -->
  <div id="tab-customers" class="pd-tab hidden">
      <div class="pd-tab-header">
          <div>
              <h2>Customers</h2>
              <p class="pd-tab-subtitle">Customers who have ordered from your restaurant.</p>
          </div>
      </div>
      <div class="pd-table-wrap">
          <table class="pd-orders-table" id="customers-table">
              <thead>
                  <tr>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Joined</th>
                  </tr>
              </thead>
              <tbody id="customers-tbody"></tbody>
          </table>
      </div>
      <div id="customers-empty" class="pd-empty hidden">
          <i class="fas fa-users"></i>
          <h3>No customers yet</h3>
          <p>Customers will appear here once orders are placed.</p>
      </div>
  </div>

  <!-- ===== Analytics Tab ===== -->
  <div id="tab-analytics" class="pd-tab hidden">
      <div class="pd-tab-header">
          <div>
              <h2>Analytics</h2>
              <p class="pd-tab-subtitle">Sales and popularity snapshot.</p>
          </div>
          <button class="btn btn-outline" onclick="loadAnalytics()">
              <i class="fas fa-sync-alt"></i> Refresh
          </button>
      </div>
      <div class="overview-grid" id="analytics-grid"></div>
      <div class="pd-panel" style="margin-top:1.5rem">
          <h3 class="pd-panel-title">Popular Items</h3>
          <div class="pd-table-wrap">
              <table class="pd-orders-table" id="analytics-items-table">
                  <thead>
                      <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Qty Sold</th>
                          <th>Revenue</th>
                      </tr>
                  </thead>
                  <tbody id="analytics-items-tbody"></tbody>
              </table>
          </div>
      </div>
  </div>

  <!-- ===== Payments Tab ===== -->
  <div id="tab-payments" class="pd-tab hidden">
      <div class="pd-tab-header">
          <div>
              <h2>Payments</h2>
              <p class="pd-tab-subtitle">Transaction history for your restaurant.</p>
          </div>
          <button class="btn btn-outline" onclick="loadPayments()">
              <i class="fas fa-sync-alt"></i> Refresh
          </button>
      </div>
      <div class="pd-table-wrap">
          <table class="pd-orders-table" id="payments-table">
              <thead>
                  <tr>
                      <th>Order ID</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Date</th>
                  </tr>
              </thead>
              <tbody id="payments-tbody"></tbody>
          </table>
      </div>
      <div id="payments-empty" class="pd-empty hidden">
          <i class="fas fa-credit-card"></i>
          <h3>No transactions yet</h3>
          <p>Payments will appear here once orders are completed.</p>
      </div>
  </div>
  ```

- [ ] **Step 4: Update the orders table — add Actions column**

  Find the `<thead>` inside `tab-orders`. Change:
  ```html
  <tr>
      <th>Order ID</th>
      <th>Items</th>
      <th>Total</th>
      <th>Payment</th>
      <th>Status</th>
      <th>Date</th>
  </tr>
  ```
  To:
  ```html
  <tr>
      <th>Order ID</th>
      <th>Items</th>
      <th>Total</th>
      <th>Payment</th>
      <th>Status</th>
      <th>Date</th>
      <th>Actions</th>
  </tr>
  ```

- [ ] **Step 5: Add add-ons section to the food modal**

  In `partner-dashboard.html`, find the food modal's `<form id="food-form">`. After the last `<div class="form-row">` (the vegetarian/popular toggles row) and before `<div id="food-form-error"...>`, add:

  ```html
  <div class="form-group full-width">
      <label>Add-ons <span style="font-size:0.75rem;color:rgba(239,243,247,0.42);font-weight:400;">(optional extras with separate prices)</span></label>
      <div id="addons-list" class="addons-list"></div>
      <button type="button" class="btn btn-outline btn-sm" id="add-addon-btn" style="margin-top:0.5rem">
          <i class="fas fa-plus"></i> Add Add-on
      </button>
  </div>
  ```

- [ ] **Step 6: Add CSS for new elements**

  At the end of `frontend/assets/css/partner-dashboard.css`, append:

  ```css
  /* ---- Nav group labels ---- */
  .pd-nav-group-label {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(239,243,247,0.28);
      padding: 0.75rem 1.1rem 0.25rem;
      border-top: 1px solid rgba(255,255,255,0.05);
      margin-top: 0.25rem;
  }

  .pd-nav-item:first-child + .pd-nav-group-label,
  .pd-nav-group-label:first-child {
      border-top: none;
      margin-top: 0;
  }

  /* ---- Overview grid ---- */
  .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
  }

  .overview-stat-card {
      background: linear-gradient(180deg, rgba(16,19,22,0.86), rgba(10,12,15,0.82));
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 1.2rem 1.4rem;
      backdrop-filter: blur(20px);
  }

  .overview-stat-card .osc-value {
      font-size: 1.6rem;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1;
      margin-bottom: 0.35rem;
  }

  .overview-stat-card .osc-label {
      font-size: 0.78rem;
      color: rgba(239,243,247,0.42);
  }

  .overview-stat-card.accent .osc-value { color: #ff8558; }

  /* ---- Overview panels ---- */
  .overview-sections {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
  }

  @media (max-width: 820px) {
      .overview-sections { grid-template-columns: 1fr; }
  }

  .pd-panel {
      background: linear-gradient(180deg, rgba(16,19,22,0.86), rgba(10,12,15,0.82));
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 1.25rem 1.4rem;
      backdrop-filter: blur(20px);
  }

  .pd-panel-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: rgba(239,243,247,0.7);
      margin-bottom: 1rem;
      padding-bottom: 0.6rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  /* ---- Shared table wrapper for new tabs ---- */
  .pd-table-wrap {
      overflow-x: auto;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.07);
  }

  /* ---- Add-ons editor in food modal ---- */
  .addons-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
  }

  .addon-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
  }

  .addon-row .addon-name {
      flex: 2;
      padding: 0.5rem 0.75rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 0.875rem;
      font-family: inherit;
  }

  .addon-row .addon-price {
      flex: 1;
      padding: 0.5rem 0.75rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 0.875rem;
      font-family: inherit;
  }

  .addon-row .addon-name:focus,
  .addon-row .addon-price:focus {
      outline: none;
      border-color: rgba(232,92,44,0.4);
  }

  /* ---- Order status select ---- */
  .order-status-select {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 7px;
      color: #e2e8f0;
      font-size: 0.8rem;
      padding: 0.3rem 0.5rem;
      font-family: inherit;
      cursor: pointer;
  }

  .order-status-select:focus { outline: none; border-color: rgba(232,92,44,0.4); }
  .order-status-select:disabled { opacity: 0.5; cursor: default; }

  /* Status badge colours for order rows */
  .order-status-select.status-pending    { color: #94a3b8; }
  .order-status-select.status-confirmed  { color: #60a5fa; }
  .order-status-select.status-preparing  { color: #f59e0b; }
  .order-status-select.status-out_for_delivery { color: #a78bfa; }
  .order-status-select.status-delivered  { color: #22c55e; }
  .order-status-select.status-cancelled  { color: #ef4444; }

  /* ---- Driver / Promo status badges ---- */
  .status-badge {
      display: inline-block;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: capitalize;
  }

  .status-badge.available { background: rgba(34,197,94,0.15); color: #22c55e; }
  .status-badge.busy      { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .status-badge.offline   { background: rgba(100,116,139,0.15); color: #64748b; }
  .status-badge.active    { background: rgba(34,197,94,0.15); color: #22c55e; }
  .status-badge.inactive  { background: rgba(100,116,139,0.15); color: #64748b; }
  ```

- [ ] **Step 7: Verify HTML structure**

  Open `frontend/pages/partner-dashboard.html` in a browser (serve with `python -m http.server 5500` from the frontend dir). Confirm the sidebar shows Overview → Restaurant group → Operations group → Business group. Stats sidebar shows the new Active Orders row. No broken layout.

- [ ] **Step 8: Commit**

  ```bash
  git add frontend/pages/partner-dashboard.html frontend/assets/css/partner-dashboard.css
  git commit -m "feat(partner-dashboard): grouped sidebar, new tab shells, add-ons modal section"
  ```

---

## Task 7: Frontend JS — Tab switching + overview tab

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Update `setupTabs` to load tab data on switch**

  Find the `setupTabs` function. Replace it entirely:

  ```js
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
  ```

- [ ] **Step 2: Update `loadDashboard` to switch to overview tab and populate Active Orders stat**

  Find the `loadDashboard` function. Change the two lines that set stats and call `switchTab`:

  ```js
  // Replace the stat-status line and switchTab('menu') call:
  document.getElementById('stat-active-orders').textContent = data.stats.active_orders || 0;

  // ...existing stat lines stay the same...

  // Change switchTab('menu') to:
  await loadOverviewContent(data);
  switchTab('overview');
  ```

  The full updated block inside the `try`:
  ```js
  const data = await apiCall('/restaurant/dashboard');

  document.getElementById('pd-restaurant-name').textContent = data.restaurant.name;
  document.getElementById('stat-foods').textContent = data.stats.total_foods;
  document.getElementById('stat-orders').textContent = data.stats.total_orders;
  document.getElementById('stat-revenue').textContent = `${data.stats.total_revenue.toFixed(2)}Tk`;
  document.getElementById('stat-status').textContent = data.restaurant.is_open ? 'Open' : 'Closed';
  document.getElementById('stat-status').style.color = data.restaurant.is_open ? '#00b894' : '#ff7675';
  document.getElementById('stat-active-orders').textContent = data.stats.active_orders || 0;

  const activeBadge = document.getElementById('active-orders-badge');
  if (data.stats.active_orders > 0) {
      activeBadge.textContent = data.stats.active_orders;
      activeBadge.style.display = 'inline-block';
  }

  await loadFoods();
  prefillProfileForm(data.restaurant);
  loading.style.display = 'none';
  await loadOverviewContent(data);
  switchTab('overview');
  ```

- [ ] **Step 3: Add `loadOverviewContent` function**

  Add this function near `loadDashboard`:

  ```js
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
  ```

- [ ] **Step 4: Verify in browser**

  Open partner-dashboard, log in as a restaurant admin. Confirm the Overview tab loads first and shows stat cards + recent orders + popular items panel.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): overview tab and updated tab switching"
  ```

---

## Task 8: Frontend JS — Orders tab: status controls

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Update `loadOrders` to add Actions column**

  Find the `loadOrders` function. Replace the `tbody.innerHTML = orders.map(order => ...)` block:

  ```js
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
  ```

- [ ] **Step 2: Wire up status select and cancel button listeners**

  After the `tbody.innerHTML` assignment in `loadOrders`, add:

  ```js
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
  ```

- [ ] **Step 3: Verify in browser**

  Go to Orders tab. Each non-terminal order row should show a status dropdown and Cancel button. Change a status — confirm it saves without page reload.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): order status controls and cancel button"
  ```

---

## Task 9: Frontend JS — Food modal add-ons

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Add add-on helper functions**

  Add these functions near the food modal functions:

  ```js
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
  ```

- [ ] **Step 2: Wire up the "Add Add-on" button in `setupFoodModal`**

  In `setupFoodModal`, add:
  ```js
  document.getElementById('add-addon-btn').addEventListener('click', () => addAddonRow());
  ```

- [ ] **Step 3: Populate add-ons in `openAddFoodModal`**

  In `openAddFoodModal`, after `setImagePreview(null);`, add:
  ```js
  renderAddonRows([]);
  ```

- [ ] **Step 4: Populate add-ons in `openEditFoodModal`**

  In `openEditFoodModal`, after `setImagePreview(...)`, add:
  ```js
  renderAddonRows(food.addons || []);
  ```

- [ ] **Step 5: Send add-ons in `saveFoodItem`**

  In `saveFoodItem`, add `addons` to the `data` object:
  ```js
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
  ```

- [ ] **Step 6: Verify in browser**

  Open "Add Food Item" modal — confirm the Add-on section appears at the bottom. Add 2 add-ons, save the item. Re-open edit modal — confirm the 2 add-ons are pre-populated.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): food modal add-ons editor"
  ```

---

## Task 10: Frontend JS — Deliveries tab

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Add state variables for deliveries**

  Near the existing state variables (`let currentFoods`, `let editingFoodId`, etc.), add:

  ```js
  let editingDriverId = null;
  ```

- [ ] **Step 2: Add `loadDrivers` function**

  ```js
  async function loadDrivers() {
      const tbody = document.getElementById('drivers-tbody');
      const empty = document.getElementById('drivers-empty');
      const table = document.getElementById('drivers-table');

      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem">Loading...</td></tr>';
      table.closest('.pd-table-wrap').style.display = '';
      empty.classList.add('hidden');

      try {
          const data = await apiCall('/restaurant/deliveries');
          const drivers = data.results || [];

          if (!drivers.length) {
              table.closest('.pd-table-wrap').style.display = 'none';
              empty.classList.remove('hidden');
              return;
          }

          tbody.innerHTML = drivers.map(d => `
              <tr>
                  <td style="color:#e2e8f0;font-weight:500">${escHtml(d.name)}</td>
                  <td style="color:#94a3b8">${escHtml(d.phone)}</td>
                  <td style="color:#94a3b8">${escHtml(d.zone || '—')}</td>
                  <td><span class="status-badge ${d.status}">${d.status}</span></td>
                  <td style="color:#f1f5f9">${Number(d.rating || 0).toFixed(1)} ⭐</td>
                  <td>
                      <button class="btn btn-outline btn-sm driver-edit-btn" data-id="${d.delivery_person_id}" style="font-size:0.75rem;padding:0.3rem 0.6rem;margin-right:4px">Edit</button>
                      <button class="btn btn-danger btn-sm driver-delete-btn" data-id="${d.delivery_person_id}" data-name="${escHtml(d.name)}" style="font-size:0.75rem;padding:0.3rem 0.6rem">Delete</button>
                  </td>
              </tr>
          `).join('');

          tbody.querySelectorAll('.driver-edit-btn').forEach(btn => {
              btn.addEventListener('click', () => openDriverModal(Number(btn.dataset.id), drivers));
          });
          tbody.querySelectorAll('.driver-delete-btn').forEach(btn => {
              btn.addEventListener('click', () => deleteDriver(Number(btn.dataset.id), btn.dataset.name));
          });
      } catch (err) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#fc8181;padding:2rem">${err.message}</td></tr>`;
      }
  }
  ```

- [ ] **Step 3: Add driver modal HTML to `partner-dashboard.html`**

  Before the closing `</body>` tag (after the existing modals), add:

  ```html
  <!-- ===== Driver Modal ===== -->
  <div class="pd-modal-overlay hidden" id="driver-modal-overlay">
      <div class="pd-modal">
          <div class="pd-modal-header">
              <h3 id="driver-modal-title">Add Driver</h3>
              <button class="pd-modal-close" id="driver-modal-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="pd-modal-body">
              <form id="driver-form" novalidate>
                  <input type="hidden" id="driver-id">
                  <div class="form-row">
                      <div class="form-group">
                          <label for="driver-name">Name <span class="required">*</span></label>
                          <input type="text" id="driver-name" placeholder="e.g. Rahim Hossain" required>
                      </div>
                      <div class="form-group">
                          <label for="driver-phone">Phone <span class="required">*</span></label>
                          <input type="tel" id="driver-phone" placeholder="+8801711111111" required>
                      </div>
                  </div>
                  <div class="form-row">
                      <div class="form-group">
                          <label for="driver-email">Email</label>
                          <input type="email" id="driver-email" placeholder="driver@example.com">
                      </div>
                      <div class="form-group">
                          <label for="driver-zone">Zone</label>
                          <input type="text" id="driver-zone" placeholder="e.g. Gulshan">
                      </div>
                  </div>
                  <div class="form-row">
                      <div class="form-group">
                          <label for="driver-status">Status</label>
                          <select id="driver-status">
                              <option value="available">Available</option>
                              <option value="busy">Busy</option>
                              <option value="offline">Offline</option>
                          </select>
                      </div>
                      <div class="form-group">
                          <label for="driver-rating">Rating (0–5)</label>
                          <input type="number" id="driver-rating" placeholder="4.8" min="0" max="5" step="0.1">
                      </div>
                  </div>
                  <div id="driver-form-error" class="pd-form-error hidden"></div>
              </form>
          </div>
          <div class="pd-modal-footer">
              <button class="btn btn-outline" id="driver-modal-cancel">Cancel</button>
              <button class="btn btn-primary" id="driver-modal-save"><i class="fas fa-save"></i> Save</button>
          </div>
      </div>
  </div>
  ```

- [ ] **Step 4: Add driver modal JS functions**

  ```js
  function setupDriverModal() {
      document.getElementById('add-driver-btn').addEventListener('click', () => openDriverModal(null, []));
      document.getElementById('driver-modal-close').addEventListener('click', () => closeModal('driver-modal-overlay'));
      document.getElementById('driver-modal-cancel').addEventListener('click', () => closeModal('driver-modal-overlay'));
      document.getElementById('driver-modal-save').addEventListener('click', saveDriver);
  }

  function openDriverModal(driverId, drivers) {
      editingDriverId = driverId;
      const driver = driverId ? drivers.find(d => d.delivery_person_id === driverId) : null;
      document.getElementById('driver-modal-title').textContent = driver ? 'Edit Driver' : 'Add Driver';
      document.getElementById('driver-id').value = driverId || '';
      document.getElementById('driver-name').value = driver?.name || '';
      document.getElementById('driver-phone').value = driver?.phone || '';
      document.getElementById('driver-email').value = driver?.email || '';
      document.getElementById('driver-zone').value = driver?.zone || '';
      document.getElementById('driver-status').value = driver?.status || 'available';
      document.getElementById('driver-rating').value = driver?.rating || '';
      document.getElementById('driver-form-error').classList.add('hidden');
      openModal('driver-modal-overlay');
  }

  async function saveDriver() {
      const errorDiv = document.getElementById('driver-form-error');
      errorDiv.classList.add('hidden');
      const name = document.getElementById('driver-name').value.trim();
      const phone = document.getElementById('driver-phone').value.trim();
      if (!name || !phone) {
          showModalError(errorDiv, 'Name and phone are required.');
          return;
      }

      const body = {
          name,
          phone,
          email: document.getElementById('driver-email').value.trim(),
          zone: document.getElementById('driver-zone').value.trim(),
          status: document.getElementById('driver-status').value,
          rating: parseFloat(document.getElementById('driver-rating').value) || 4.8
      };

      const saveBtn = document.getElementById('driver-modal-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
          if (editingDriverId) {
              await apiCall(`/restaurant/deliveries/${editingDriverId}`, { method: 'PUT', body: JSON.stringify(body) });
          } else {
              await apiCall('/restaurant/deliveries', { method: 'POST', body: JSON.stringify(body) });
          }
          closeModal('driver-modal-overlay');
          await loadDrivers();
      } catch (err) {
          showModalError(errorDiv, err.message);
      } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
      }
  }

  async function deleteDriver(driverId, driverName) {
      if (!confirm(`Delete driver "${driverName}"?`)) return;
      try {
          await apiCall(`/restaurant/deliveries/${driverId}`, { method: 'DELETE' });
          await loadDrivers();
      } catch (err) {
          alert('Failed to delete: ' + err.message);
      }
  }
  ```

- [ ] **Step 5: Call `setupDriverModal()` from the `DOMContentLoaded` handler**

  In the `document.addEventListener('DOMContentLoaded', function () {` block, add:
  ```js
  setupDriverModal();
  ```

- [ ] **Step 6: Verify**

  Go to Deliveries tab. Confirm the driver table loads. Click Add Driver, fill the form, save. Confirm the new driver appears. Edit and delete should also work.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/pages/partner-dashboard.html frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): deliveries tab with driver CRUD"
  ```

---

## Task 11: Frontend JS — Promotions tab

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`
- Modify: `frontend/pages/partner-dashboard.html` (promo modal)

- [ ] **Step 1: Add state variable**

  Near other state variables:
  ```js
  let editingPromoId = null;
  ```

- [ ] **Step 2: Add `loadPromos` function**

  ```js
  async function loadPromos() {
      const tbody = document.getElementById('promos-tbody');
      const empty = document.getElementById('promos-empty');
      const table = document.getElementById('promos-table');

      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:2rem">Loading...</td></tr>';
      table.closest('.pd-table-wrap').style.display = '';
      empty.classList.add('hidden');

      try {
          const data = await apiCall('/restaurant/promotions');
          const promos = data.results || [];

          if (!promos.length) {
              table.closest('.pd-table-wrap').style.display = 'none';
              empty.classList.remove('hidden');
              return;
          }

          tbody.innerHTML = promos.map(p => `
              <tr>
                  <td style="font-family:monospace;font-weight:600;color:#ff8558">${escHtml(p.code)}</td>
                  <td style="color:#e2e8f0">${escHtml(p.title)}</td>
                  <td style="color:#94a3b8;text-transform:capitalize">${p.discount_type}</td>
                  <td style="color:#f1f5f9">${p.discount_type === 'percentage' ? p.discount_value + '%' : Number(p.discount_value).toFixed(2) + 'Tk'}</td>
                  <td><span class="status-badge ${p.active ? 'active' : 'inactive'}">${p.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                      <button class="btn btn-outline btn-sm promo-edit-btn" data-id="${p.promotion_id}" style="font-size:0.75rem;padding:0.3rem 0.6rem;margin-right:4px">Edit</button>
                      <button class="btn btn-danger btn-sm promo-delete-btn" data-id="${p.promotion_id}" data-name="${escHtml(p.code)}" style="font-size:0.75rem;padding:0.3rem 0.6rem">Delete</button>
                  </td>
              </tr>
          `).join('');

          // Store promos data for edit modal
          tbody.dataset.promos = JSON.stringify(promos);

          tbody.querySelectorAll('.promo-edit-btn').forEach(btn => {
              btn.addEventListener('click', () => openPromoModal(Number(btn.dataset.id), promos));
          });
          tbody.querySelectorAll('.promo-delete-btn').forEach(btn => {
              btn.addEventListener('click', () => deletePromo(Number(btn.dataset.id), btn.dataset.name));
          });
      } catch (err) {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#fc8181;padding:2rem">${err.message}</td></tr>`;
      }
  }
  ```

- [ ] **Step 3: Add promo modal HTML to `partner-dashboard.html`**

  Before `</body>`, add:

  ```html
  <!-- ===== Promo Modal ===== -->
  <div class="pd-modal-overlay hidden" id="promo-modal-overlay">
      <div class="pd-modal">
          <div class="pd-modal-header">
              <h3 id="promo-modal-title">Add Promotion</h3>
              <button class="pd-modal-close" id="promo-modal-close"><i class="fas fa-times"></i></button>
          </div>
          <div class="pd-modal-body">
              <form id="promo-form" novalidate>
                  <input type="hidden" id="promo-id">
                  <div class="form-row">
                      <div class="form-group">
                          <label for="promo-code">Code <span class="required">*</span></label>
                          <input type="text" id="promo-code" placeholder="e.g. SAVE20" required style="text-transform:uppercase">
                      </div>
                      <div class="form-group">
                          <label for="promo-title">Title <span class="required">*</span></label>
                          <input type="text" id="promo-title" placeholder="e.g. 20% off all orders" required>
                      </div>
                  </div>
                  <div class="form-group">
                      <label for="promo-description">Description</label>
                      <textarea id="promo-description" rows="2" placeholder="Optional description..."></textarea>
                  </div>
                  <div class="form-row">
                      <div class="form-group">
                          <label for="promo-type">Discount Type</label>
                          <select id="promo-type">
                              <option value="percentage">Percentage (%)</option>
                              <option value="flat">Flat (Tk)</option>
                          </select>
                      </div>
                      <div class="form-group">
                          <label for="promo-value">Discount Value <span class="required">*</span></label>
                          <input type="number" id="promo-value" placeholder="0" min="0" step="0.01" required>
                      </div>
                  </div>
                  <div class="form-group">
                      <label class="toggle-label">
                          <input type="checkbox" id="promo-active" checked>
                          <span class="toggle-track"><span class="toggle-thumb"></span></span>
                          Active
                      </label>
                  </div>
                  <div id="promo-form-error" class="pd-form-error hidden"></div>
              </form>
          </div>
          <div class="pd-modal-footer">
              <button class="btn btn-outline" id="promo-modal-cancel">Cancel</button>
              <button class="btn btn-primary" id="promo-modal-save"><i class="fas fa-save"></i> Save</button>
          </div>
      </div>
  </div>
  ```

- [ ] **Step 4: Add promo modal JS functions**

  ```js
  function setupPromoModal() {
      document.getElementById('add-promo-btn').addEventListener('click', () => openPromoModal(null, []));
      document.getElementById('promo-modal-close').addEventListener('click', () => closeModal('promo-modal-overlay'));
      document.getElementById('promo-modal-cancel').addEventListener('click', () => closeModal('promo-modal-overlay'));
      document.getElementById('promo-modal-save').addEventListener('click', savePromo);
  }

  function openPromoModal(promoId, promos) {
      editingPromoId = promoId;
      const promo = promoId ? promos.find(p => p.promotion_id === promoId) : null;
      document.getElementById('promo-modal-title').textContent = promo ? 'Edit Promotion' : 'Add Promotion';
      document.getElementById('promo-id').value = promoId || '';
      document.getElementById('promo-code').value = promo?.code || '';
      document.getElementById('promo-title').value = promo?.title || '';
      document.getElementById('promo-description').value = promo?.description || '';
      document.getElementById('promo-type').value = promo?.discount_type || 'percentage';
      document.getElementById('promo-value').value = promo?.discount_value ?? '';
      document.getElementById('promo-active').checked = promo ? Boolean(promo.active) : true;
      document.getElementById('promo-form-error').classList.add('hidden');
      openModal('promo-modal-overlay');
  }

  async function savePromo() {
      const errorDiv = document.getElementById('promo-form-error');
      errorDiv.classList.add('hidden');
      const code = document.getElementById('promo-code').value.trim().toUpperCase();
      const title = document.getElementById('promo-title').value.trim();
      const value = document.getElementById('promo-value').value;
      if (!code || !title || value === '') {
          showModalError(errorDiv, 'Code, title, and discount value are required.');
          return;
      }

      const body = {
          code,
          title,
          description: document.getElementById('promo-description').value.trim(),
          discount_type: document.getElementById('promo-type').value,
          discount_value: Number(value),
          active: document.getElementById('promo-active').checked
      };

      const saveBtn = document.getElementById('promo-modal-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
          if (editingPromoId) {
              await apiCall(`/restaurant/promotions/${editingPromoId}`, { method: 'PUT', body: JSON.stringify(body) });
          } else {
              await apiCall('/restaurant/promotions', { method: 'POST', body: JSON.stringify(body) });
          }
          closeModal('promo-modal-overlay');
          await loadPromos();
      } catch (err) {
          showModalError(errorDiv, err.message);
      } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
      }
  }

  async function deletePromo(promoId, code) {
      if (!confirm(`Delete promotion "${code}"?`)) return;
      try {
          await apiCall(`/restaurant/promotions/${promoId}`, { method: 'DELETE' });
          await loadPromos();
      } catch (err) {
          alert('Failed to delete: ' + err.message);
      }
  }
  ```

- [ ] **Step 5: Call `setupPromoModal()` in `DOMContentLoaded`**

  ```js
  setupPromoModal();
  ```

- [ ] **Step 6: Verify**

  Go to Promotions tab. Add a promotion (code: `TEST10`, type: percentage, value: 10). Confirm it appears in the table. Edit and delete should also work.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/pages/partner-dashboard.html frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): promotions tab with CRUD"
  ```

---

## Task 12: Frontend JS — Customers tab (read-only)

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Add `loadCustomers` function**

  ```js
  async function loadCustomers() {
      const tbody = document.getElementById('customers-tbody');
      const empty = document.getElementById('customers-empty');
      const table = document.getElementById('customers-table');

      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:2rem">Loading...</td></tr>';
      table.closest('.pd-table-wrap').style.display = '';
      empty.classList.add('hidden');

      try {
          const data = await apiCall('/restaurant/customers');
          const customers = data.results || [];

          if (!customers.length) {
              table.closest('.pd-table-wrap').style.display = 'none';
              empty.classList.remove('hidden');
              return;
          }

          tbody.innerHTML = customers.map(c => `
              <tr>
                  <td style="color:#e2e8f0;font-weight:500">${escHtml(c.name)}</td>
                  <td style="color:#94a3b8">${escHtml(c.email || '—')}</td>
                  <td style="color:#f1f5f9">${c.order_count}</td>
                  <td style="color:#f1f5f9;font-weight:600">${Number(c.total_spent).toFixed(2)}Tk</td>
                  <td style="color:#64748b;font-size:0.8rem">${c.joined_at ? formatDate(c.joined_at) : '—'}</td>
              </tr>
          `).join('');
      } catch (err) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#fc8181;padding:2rem">${err.message}</td></tr>`;
      }
  }
  ```

- [ ] **Step 2: Verify**

  Go to Customers tab. Confirm the customer list renders. No edit controls should be visible.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): customers tab (read-only)"
  ```

---

## Task 13: Frontend JS — Analytics tab (read-only)

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Add `loadAnalytics` function**

  ```js
  async function loadAnalytics() {
      const grid = document.getElementById('analytics-grid');
      const tbody = document.getElementById('analytics-items-tbody');

      grid.innerHTML = '<p style="color:#64748b;font-size:0.85rem">Loading...</p>';
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:2rem">Loading...</td></tr>';

      try {
          const data = await apiCall('/restaurant/analytics');

          grid.innerHTML = `
              <div class="overview-stat-card">
                  <div class="osc-value">${data.total_orders}</div>
                  <div class="osc-label">Total Orders</div>
              </div>
              <div class="overview-stat-card">
                  <div class="osc-value">${Number(data.total_revenue).toFixed(2)}Tk</div>
                  <div class="osc-label">Total Revenue</div>
              </div>
              <div class="overview-stat-card">
                  <div class="osc-value">${Number(data.avg_order_value).toFixed(2)}Tk</div>
                  <div class="osc-label">Avg Order Value</div>
              </div>
              <div class="overview-stat-card">
                  <div class="osc-value" style="font-size:1.1rem">${escHtml(data.top_category)}</div>
                  <div class="osc-label">Top Category</div>
              </div>
          `;

          const items = data.popular_items || [];
          if (!items.length) {
              tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:2rem">No data yet</td></tr>';
              return;
          }

          tbody.innerHTML = items.map(item => `
              <tr>
                  <td style="color:#e2e8f0;font-weight:500">${escHtml(item.name)}</td>
                  <td style="color:#94a3b8">${escHtml(item.category || '—')}</td>
                  <td style="color:#f1f5f9">${item.qty}</td>
                  <td style="color:#f1f5f9;font-weight:600">${Number(item.revenue).toFixed(2)}Tk</td>
              </tr>
          `).join('');
      } catch (err) {
          grid.innerHTML = `<p style="color:#fc8181">${err.message}</p>`;
          tbody.innerHTML = '';
      }
  }
  ```

- [ ] **Step 2: Verify**

  Go to Analytics tab. Confirm stat cards and popular items table populate from real order data.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): analytics tab"
  ```

---

## Task 14: Frontend JS — Payments tab (read-only)

**Files:**
- Modify: `frontend/assets/js/partner-dashboard.js`

- [ ] **Step 1: Add `loadPayments` function**

  ```js
  async function loadPayments() {
      const tbody = document.getElementById('payments-tbody');
      const empty = document.getElementById('payments-empty');
      const table = document.getElementById('payments-table');

      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:2rem">Loading...</td></tr>';
      table.closest('.pd-table-wrap').style.display = '';
      empty.classList.add('hidden');

      try {
          const data = await apiCall('/restaurant/payments');
          const payments = data.results || [];

          if (!payments.length) {
              table.closest('.pd-table-wrap').style.display = 'none';
              empty.classList.remove('hidden');
              return;
          }

          tbody.innerHTML = payments.map(p => `
              <tr>
                  <td style="font-family:monospace;font-size:0.8rem;color:#94a3b8">#${p.order_id}</td>
                  <td style="font-weight:600;color:#f1f5f9">${Number(p.amount).toFixed(2)}Tk</td>
                  <td style="color:#94a3b8;text-transform:capitalize">${p.method}</td>
                  <td><span class="status-badge ${p.status === 'paid' ? 'active' : 'offline'}">${p.status}</span></td>
                  <td style="color:#64748b;font-size:0.8rem">${formatDate(p.created_at)}</td>
              </tr>
          `).join('');
      } catch (err) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#fc8181;padding:2rem">${err.message}</td></tr>`;
      }
  }
  ```

- [ ] **Step 2: Verify**

  Go to Payments tab. Transaction list renders with order ID, amount, method, status, date.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/assets/js/partner-dashboard.js
  git commit -m "feat(partner-dashboard): payments tab"
  ```

---

## Task 15: Cleanup — Delete admin frontend files

**Files:**
- Delete: `frontend/pages/admin.html`
- Delete: `frontend/assets/js/admin.js`
- Delete: `frontend/assets/css/admin.css`

> **Do NOT delete** `backend/src/routes/admin.js` — it contains superadmin routes still used by `superadmin.html`.

- [ ] **Step 1: Remove frontend admin files**

  ```bash
  rm frontend/pages/admin.html
  rm frontend/assets/js/admin.js
  rm frontend/assets/css/admin.css
  ```

- [ ] **Step 2: Confirm superadmin.html still loads**

  Open `frontend/pages/superadmin.html` in the browser. Confirm it loads without errors (it doesn't depend on admin.js or admin.css).

- [ ] **Step 3: Confirm no remaining references to deleted files**

  ```bash
  grep -r "admin\.html\|admin\.js\|admin\.css" frontend/ --include="*.html" --include="*.js"
  ```

  Expected: no output (or only references to `superadmin.html` / `superadmin.js` which are separate files).

- [ ] **Step 4: Commit**

  ```bash
  git add -A
  git commit -m "chore: delete admin frontend files (admin.html, admin.js, admin.css)"
  ```

---

## Self-Review Checklist

- **Spec: grouped sidebar** → Task 6 Step 1 ✅
- **Spec: overview tab** → Task 7 ✅
- **Spec: order status controls + cancel** → Task 1 (backend) + Task 8 (frontend) ✅
- **Spec: food add-ons** → Task 9 ✅ (model/store already supported, only frontend needed)
- **Spec: deliveries tab** → Task 2 (backend) + Task 10 (frontend) ✅
- **Spec: promotions tab** → Task 3 (backend) + Task 11 (frontend) ✅
- **Spec: customers tab (read-only)** → Task 4 (backend) + Task 12 (frontend) ✅
- **Spec: analytics tab (read-only)** → Task 4 (backend) + Task 13 (frontend) ✅
- **Spec: payments tab (read-only)** → Task 4 (backend) + Task 14 (frontend) ✅
- **Spec: fix Pizzaburg/Peyari roles** → Task 5 ✅
- **Spec: delete admin frontend files** → Task 15 ✅
- **Spec: keep superadmin routes** → noted in Task 15, backend admin.js not deleted ✅
- **Active Orders stat in sidebar** → Task 6 Step 2 + Task 7 Step 2 ✅
- **Type consistency**: `delivery_person_id` used in Task 2 and Task 10; `promotion_id` in Task 3 and Task 11; `order_id` in Task 1 and Task 8 — all consistent ✅
