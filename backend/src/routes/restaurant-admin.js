import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireRestaurantAdmin } from '../middleware/auth.js';
import { Order, DeliveryPerson, Promotion, User } from '../models/index.js';
import { getNextSequence } from '../utils/counters.js';
import {
  getRestaurantAdminDashboard,
  getRestaurantFoods,
  createRestaurantFood,
  updateRestaurantFood,
  deleteRestaurantFood,
  getRestaurantOrders,
  updateRestaurantProfile,
  getRestaurantAnalytics
} from '../data/store.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuImagesDir = path.resolve(__dirname, '../../../images/menu-images');

function sanitizeImageFileName(value = '') {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return path.basename(normalized).replace(/[^a-zA-Z0-9._ -]/g, '');
}

async function persistMenuImage(fileName, dataUrl) {
  const safeName = sanitizeImageFileName(fileName);
  if (!safeName) {
    const error = new Error('Invalid image filename');
    error.status = 400;
    throw error;
  }
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    const error = new Error('Invalid image payload');
    error.status = 400;
    throw error;
  }
  const buffer = Buffer.from(match[2], 'base64');
  await fs.mkdir(menuImagesDir, { recursive: true });
  await fs.writeFile(path.join(menuImagesDir, safeName), buffer);
  return safeName;
}

// All routes require restaurant_admin or superadmin
router.use(requireAuth, requireRestaurantAdmin);

// Helper: extract restaurant_id from the authenticated user
function getRestaurantId(req) {
  const rid = req.user.restaurant_id;
  if (!rid) {
    const error = new Error('No restaurant linked to this account');
    error.status = 403;
    throw error;
  }
  return Number(rid);
}

// GET /api/restaurant/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const data = await getRestaurantAdminDashboard(restaurantId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/restaurant/foods
router.get('/foods', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const result = await getRestaurantFoods(restaurantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/restaurant/foods
router.post('/foods', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const created = await createRestaurantFood(restaurantId, req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// PUT /api/restaurant/foods/:food_id
router.put('/foods/:food_id', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const updated = await updateRestaurantFood(req.params.food_id, restaurantId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/restaurant/foods/:food_id
router.delete('/foods/:food_id', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    await deleteRestaurantFood(req.params.food_id, restaurantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/restaurant/orders
router.get('/orders', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const result = await getRestaurantOrders(restaurantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PUT /api/restaurant/profile
router.put('/profile', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const updated = await updateRestaurantProfile(restaurantId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// POST /api/restaurant/uploads/menu-image
router.post('/uploads/menu-image', async (req, res, next) => {
  try {
    const fileName = await persistMenuImage(req.body.filename, req.body.data);
    const imageUrl = `${req.protocol}://${req.get('host')}/images/menu-images/${fileName}`;
    res.status(201).json({ filename: fileName, image_url: imageUrl });
  } catch (error) {
    next(error);
  }
});

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

async function assignDeliveryPersonToOrder({ orderId, restaurantId, deliveryPersonId }) {
  const existing = await Order.findOne({ order_id: orderId }).lean();
  if (!existing) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }
  if (existing.restaurant?.id !== restaurantId) {
    const error = new Error('Order belongs to a different restaurant');
    error.status = 403;
    throw error;
  }
  if (['delivered', 'cancelled'].includes(existing.status)) {
    const error = new Error(`Order is already ${existing.status}`);
    error.status = 400;
    throw error;
  }

  const driver = await DeliveryPerson.findOne({ delivery_person_id: Number(deliveryPersonId) }).lean();
  if (!driver) {
    const error = new Error('Delivery person not found');
    error.status = 404;
    throw error;
  }

  const updates = {
    assigned_delivery_person_id: Number(driver.delivery_person_id),
    assigned_delivery_person_name: driver.name,
    assigned_at: new Date(),
    status: 'out_for_delivery'
  };

  const updated = await Order.findOneAndUpdate({ order_id: orderId }, updates, { new: true }).lean();

  if (existing.assigned_delivery_person_id && existing.assigned_delivery_person_id !== Number(driver.delivery_person_id)) {
    await updateDeliveryWorkload(existing.assigned_delivery_person_id, { activeDelta: -1 });
  }
  if (existing.assigned_delivery_person_id !== Number(driver.delivery_person_id)) {
    await updateDeliveryWorkload(driver.delivery_person_id, { activeDelta: 1 });
  } else if (existing.status !== 'out_for_delivery') {
    await updateDeliveryWorkload(driver.delivery_person_id, { activeDelta: 1 });
  }

  return updated;
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

// PATCH /api/restaurant/orders/:id/assign-delivery
router.patch('/orders/:id/assign-delivery', async (req, res, next) => {
  try {
    const restaurantId = getRestaurantId(req);
    const deliveryPersonId = Number(req.body.delivery_person_id);
    if (!Number.isFinite(deliveryPersonId) || deliveryPersonId < 1) {
      return res.status(400).json({ detail: 'A valid delivery_person_id is required' });
    }

    const updated = await assignDeliveryPersonToOrder({
      orderId: req.params.id,
      restaurantId,
      deliveryPersonId
    });

    res.json({
      order_id: updated.order_id,
      status: updated.status,
      assigned_delivery_person_id: updated.assigned_delivery_person_id,
      assigned_delivery_person_name: updated.assigned_delivery_person_name,
      assigned_at: updated.assigned_at
    });
  } catch (error) {
    next(error);
  }
});

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
      completed_deliveries: 0,
      active_orders: 0,
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
    const fields = ['name', 'phone', 'email', 'zone', 'status'];
    fields.forEach(f => { if (req.body[f] !== undefined) patch[f] = req.body[f]; });
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

export default router;
