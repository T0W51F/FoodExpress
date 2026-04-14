import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Order, Restaurant, Review, User, DeliveryPerson, Promotion, Food } from '../models/index.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { getNextSequence } from '../utils/counters.js';
import { serializeRestaurant } from '../utils/formatters.js';
import {
  createFood, updateFood, deleteFood, deleteFoodsByRestaurant, listMenuItems,
  listPartnerApplications, getApplicationById, approveApplication, rejectApplication,
  listAllRestaurantsAdmin, restrictRestaurant, deleteRestaurantAdmin,
  listAllUsers, getSuperadminUserById, banUser, unbanUser, adminResetPassword,
  getPlatformAnalytics, createAuditLog, listAuditLogs,
  createGlobalPromo, listGlobalPromos, toggleGlobalPromo, deleteGlobalPromo,
  createCategory, listCategories, updateCategory, toggleCategory, deleteCategory, getCategoryFoodCount
} from '../data/store.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendImagesDir = path.resolve(__dirname, '../../../frontend/assets/images/foods');

// Allow both admin and superadmin through this router.
// Individual superadmin-only routes add requireSuperAdmin themselves.
router.use(requireAuth, (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ detail: 'Admin access is required.' });
  }
  next();
});

// Returns the restaurant_id for a scoped admin, or null for superadmin (sees all)
function adminScope(user) {
  return user.restaurant_id || null;
}

// Build a MongoDB filter restricted to a specific restaurant when scoped
function withRestaurant(filter, restaurantId) {
  if (!restaurantId) return filter;
  return { ...filter, 'restaurant.id': restaurantId };
}

// 403 helper for operations that restaurant admins are not allowed to perform
function denyScoped(req, res) {
  return res.status(403).json({ detail: 'Restaurant admins cannot perform this action.' });
}

function serializeOrder(order, user = null) {
  return {
    id: order.order_id,
    order_id: order.order_id,
    user_id: order.user_id,
    customer_name: user ? `${user.first_name} ${user.last_name}`.trim() : `User ${order.user_id}`,
    customer_email: user?.email || '',
    customer_phone: user?.phone || '',
    status: order.status,
    items: order.items || [],
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    address: order.address,
    paymentMethod: order.paymentMethod,
    paymentGateway: order.paymentGateway || 'Cash on Delivery',
    paymentStatus: order.paymentStatus || 'pending',
    refundAmount: order.refundAmount || 0,
    transactionReference: order.transactionReference || '',
    cancellation_reason: order.cancellation_reason || '',
    assigned_delivery_person_id: order.assigned_delivery_person_id,
    assigned_delivery_person_name: order.assigned_delivery_person_name || '',
    restaurant: order.restaurant,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  };
}

function formatCurrency(value) {
  return Number(value || 0);
}

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
  await fs.mkdir(frontendImagesDir, { recursive: true });
  await fs.writeFile(path.join(frontendImagesDir, safeName), buffer);

  return safeName;
}

async function updateDeliveryWorkload(deliveryPersonId, { activeDelta = 0, completedDelta = 0, forceStatus = null } = {}) {
  if (!deliveryPersonId) {
    return;
  }

  const deliveryPerson = await DeliveryPerson.findOne({ delivery_person_id: Number(deliveryPersonId) });
  if (!deliveryPerson) {
    return;
  }

  const nextActiveOrders = Math.max(0, Number(deliveryPerson.active_orders || 0) + Number(activeDelta || 0));
  const nextCompletedDeliveries = Math.max(0, Number(deliveryPerson.completed_deliveries || 0) + Number(completedDelta || 0));
  const nextStatus = forceStatus || (nextActiveOrders > 0 ? 'busy' : 'available');

  await DeliveryPerson.updateOne(
    { delivery_person_id: Number(deliveryPersonId) },
    {
      active_orders: nextActiveOrders,
      completed_deliveries: nextCompletedDeliveries,
      status: nextStatus
    }
  );
}

router.get('/dashboard/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const orderFilter = scope ? { 'restaurant.id': scope } : {};
    const restaurantFilter = scope ? { restaurant_id: scope } : {};
    const foodFilter = scope ? { restaurant_id: scope } : {};

    const [orders, restaurants, foods, customers, promotions] = await Promise.all([
      Order.find(orderFilter).sort({ createdAt: -1 }).lean(),
      Restaurant.find(restaurantFilter).lean(),
      Food.find(foodFilter).lean(),
      User.find({ role: 'customer' }).lean(),
      Promotion.find().lean()
    ]);

    const ordersByStatus = {
      pending: 0,
      preparing: 0,
      delivering: 0,
      delivered: 0,
      cancelled: 0
    };

    let totalRevenue = 0;
    let cancelledRevenue = 0;
    const itemMap = new Map();

    orders.forEach(order => {
      const status = order.status || 'pending';
      if (ordersByStatus[status] !== undefined) {
        ordersByStatus[status] += 1;
      }

      if (status === 'cancelled') {
        cancelledRevenue += Number(order.total || 0);
      } else {
        totalRevenue += Number(order.total || 0);
      }

      (order.items || []).forEach(item => {
        const key = String(item.id || item.name);
        const existing = itemMap.get(key) || {
          id: item.id || null,
          name: item.name,
          category: item.category,
          quantity: 0,
          revenue: 0
        };
        existing.quantity += Number(item.quantity || 0);
        existing.revenue += Number(item.totalPrice || (item.price || 0) * (item.quantity || 0));
        itemMap.set(key, existing);
      });
    });

    const popularItems = [...itemMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    const averageOrderValue = orders.length ? totalRevenue / Math.max(orders.length - ordersByStatus.cancelled, 1) : 0;

    res.json({
      summary: {
        total_orders: orders.length,
        active_orders: ordersByStatus.pending + ordersByStatus.preparing + ordersByStatus.delivering,
        total_restaurants: restaurants.length,
        total_menu_items: foods.length,
        total_customers: customers.length,
        active_promotions: promotions.filter(item => item.active).length,
        total_revenue: Number(totalRevenue.toFixed(2)),
        net_profit_estimate: Number((totalRevenue * 0.18).toFixed(2)),
        average_order_value: Number(averageOrderValue.toFixed(2)),
        cancelled_revenue: Number(cancelledRevenue.toFixed(2))
      },
      order_status_breakdown: ordersByStatus,
      popular_items: popularItems,
      recent_orders: orders.slice(0, 6).map(order => serializeOrder(order))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/analytics/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const orderFilter = scope ? { 'restaurant.id': scope } : {};
    const orders = await Order.find(orderFilter).sort({ createdAt: -1 }).lean();
    const salesByDay = new Map();

    orders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      const current = salesByDay.get(dateKey) || { revenue: 0, orders: 0 };
      if (order.status !== 'cancelled') {
        current.revenue += Number(order.total || 0);
      }
      current.orders += 1;
      salesByDay.set(dateKey, current);
    });

    res.json({
      sales_trend: [...salesByDay.entries()].map(([date, values]) => ({ date, ...values })),
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const filter = scope ? { 'restaurant.id': scope } : {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [orders, users, deliveryPeople] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).lean(),
      User.find().lean(),
      DeliveryPerson.find().lean()
    ]);

    const userMap = new Map(users.map(user => [user.user_id, user]));
    const deliveryMap = new Map(deliveryPeople.map(person => [person.delivery_person_id, person]));

    res.json({
      count: orders.length,
      results: orders.map(order => {
        const payload = serializeOrder(order, userMap.get(order.user_id));
        if (order.assigned_delivery_person_id) {
          payload.delivery_person = deliveryMap.get(order.assigned_delivery_person_id) || null;
        }
        return payload;
      })
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:id/status/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const existingOrder = await Order.findOne({ order_id: req.params.id }).lean();
    if (!existingOrder) {
      return res.status(404).json({ detail: 'Order not found' });
    }
    if (scope && existingOrder.restaurant?.id !== scope) {
      return res.status(403).json({ detail: 'Access denied: order belongs to a different restaurant.' });
    }

    const nextStatus = req.body.status || existingOrder.status || 'pending';
    const updates = { status: nextStatus };

    if (req.body.cancellation_reason !== undefined) {
      updates.cancellation_reason = req.body.cancellation_reason;
    }

    if (nextStatus === 'delivered') {
      updates.delivered_at = existingOrder.delivered_at || new Date();
      updates.paymentStatus = req.body.paymentStatus || 'paid';
    }

    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id },
      updates,
      { new: true }
    ).lean();

    if (existingOrder.assigned_delivery_person_id && existingOrder.status === 'delivering' && nextStatus !== 'delivering') {
      await updateDeliveryWorkload(existingOrder.assigned_delivery_person_id, {
        activeDelta: -1,
        completedDelta: nextStatus === 'delivered' ? 1 : 0
      });
    }

    res.json(serializeOrder(order));
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:id/assign-delivery/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const deliveryPerson = await DeliveryPerson.findOne({ delivery_person_id: Number(req.body.delivery_person_id) }).lean();
    if (!deliveryPerson) {
      return res.status(404).json({ detail: 'Delivery person not found' });
    }

    const existingOrder = await Order.findOne({ order_id: req.params.id }).lean();
    if (!existingOrder) {
      return res.status(404).json({ detail: 'Order not found' });
    }
    if (scope && existingOrder.restaurant?.id !== scope) {
      return res.status(403).json({ detail: 'Access denied: order belongs to a different restaurant.' });
    }

    const previousDeliveryPersonId = existingOrder.assigned_delivery_person_id;
    const sameDeliveryPerson = Number(previousDeliveryPersonId || 0) === Number(deliveryPerson.delivery_person_id);

    const order = await Order.findOneAndUpdate(
      { order_id: req.params.id },
      {
        assigned_delivery_person_id: deliveryPerson.delivery_person_id,
        assigned_delivery_person_name: deliveryPerson.name,
        assigned_at: new Date(),
        status: req.body.status || 'delivering'
      },
      { new: true }
    ).lean();

    if (previousDeliveryPersonId && !sameDeliveryPerson) {
      await updateDeliveryWorkload(previousDeliveryPersonId, { activeDelta: -1 });
    }

    if (!sameDeliveryPerson) {
      await updateDeliveryWorkload(deliveryPerson.delivery_person_id, { activeDelta: 1, forceStatus: 'busy' });
    } else {
      await updateDeliveryWorkload(deliveryPerson.delivery_person_id, { forceStatus: 'busy' });
    }

    res.json(serializeOrder(order));
  } catch (error) {
    next(error);
  }
});

router.post('/uploads/menu-image/', async (req, res, next) => {
  try {
    const fileName = await persistMenuImage(req.body.filename, req.body.data);
    res.status(201).json({ filename: fileName, image_url: `/assets/images/foods/${fileName}` });
  } catch (error) {
    next(error);
  }
});

router.get('/menu-items/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const result = await listMenuItems({
      restaurant_id: scope || req.query.restaurant_id,
      category: req.query.category,
      search: req.query.search
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/menu-items/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const data = scope ? { ...req.body, restaurant_id: scope } : req.body;
    const created = await createFood(data);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put('/menu-items/:id/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    if (scope) {
      const item = await Food.findOne({ food_id: Number(req.params.id) }).lean();
      if (!item || item.restaurant_id !== scope) {
        return res.status(403).json({ detail: 'Access denied: menu item belongs to a different restaurant.' });
      }
    }
    const updated = await updateFood(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/menu-items/:id/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    if (scope) {
      const item = await Food.findOne({ food_id: Number(req.params.id) }).lean();
      if (!item || item.restaurant_id !== scope) {
        return res.status(403).json({ detail: 'Access denied: menu item belongs to a different restaurant.' });
      }
    }
    await deleteFood(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const filter = scope ? { restaurant_id: scope } : {};
    const restaurants = await Restaurant.find(filter).sort({ restaurant_id: 1 }).lean();
    res.json({ count: restaurants.length, results: restaurants.map(serializeRestaurant) });
  } catch (error) {
    next(error);
  }
});

router.post('/restaurants/', async (req, res, next) => {
  if (adminScope(req.user)) return denyScoped(req, res);
  try {
    const created = await Restaurant.create({
      restaurant_id: await getNextSequence('restaurants'),
      name: req.body.name,
      cuisine: req.body.cuisine || '',
      delivery_time: req.body.delivery_time || '25-35 min',
      rating: Number(req.body.rating || 0),
      reviews: Number(req.body.reviews || 0),
      delivery_fee: formatCurrency(req.body.delivery_fee),
      min_order: formatCurrency(req.body.min_order),
      image: req.body.image || '',
      featured: Boolean(req.body.featured),
      is_open: req.body.is_open !== undefined ? Boolean(req.body.is_open) : true,
      categories: Array.isArray(req.body.categories) ? req.body.categories : [],
      operating_hours: req.body.operating_hours || '10:00 AM - 11:00 PM',
      contact_phone: req.body.contact_phone || '',
      contact_email: req.body.contact_email || '',
      service_area: req.body.service_area || 'Dhaka'
    });

    res.status(201).json(serializeRestaurant(created.toObject()));
  } catch (error) {
    next(error);
  }
});

router.put('/restaurants/:id/', async (req, res, next) => {
  const scope = adminScope(req.user);
  if (scope && scope !== Number(req.params.id)) {
    return res.status(403).json({ detail: 'Access denied: you can only edit your own restaurant.' });
  }
  try {
    const updated = await Restaurant.findOneAndUpdate(
      { restaurant_id: Number(req.params.id) },
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.cuisine !== undefined ? { cuisine: req.body.cuisine } : {}),
        ...(req.body.delivery_time !== undefined ? { delivery_time: req.body.delivery_time } : {}),
        ...(req.body.rating !== undefined ? { rating: Number(req.body.rating) } : {}),
        ...(req.body.reviews !== undefined ? { reviews: Number(req.body.reviews) } : {}),
        ...(req.body.delivery_fee !== undefined ? { delivery_fee: formatCurrency(req.body.delivery_fee) } : {}),
        ...(req.body.min_order !== undefined ? { min_order: formatCurrency(req.body.min_order) } : {}),
        ...(req.body.image !== undefined ? { image: req.body.image } : {}),
        ...(req.body.featured !== undefined ? { featured: Boolean(req.body.featured) } : {}),
        ...(req.body.is_open !== undefined ? { is_open: Boolean(req.body.is_open) } : {}),
        ...(req.body.categories !== undefined ? { categories: Array.isArray(req.body.categories) ? req.body.categories : [] } : {}),
        ...(req.body.operating_hours !== undefined ? { operating_hours: req.body.operating_hours } : {}),
        ...(req.body.contact_phone !== undefined ? { contact_phone: req.body.contact_phone } : {}),
        ...(req.body.contact_email !== undefined ? { contact_email: req.body.contact_email } : {}),
        ...(req.body.service_area !== undefined ? { service_area: req.body.service_area } : {})
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ detail: 'Restaurant not found' });
    }

    res.json(serializeRestaurant(updated));
  } catch (error) {
    next(error);
  }
});

router.delete('/restaurants/:id/', async (req, res, next) => {
  if (adminScope(req.user)) return denyScoped(req, res);
  try {
    const restaurantId = Number(req.params.id);
    const deleted = await Restaurant.findOneAndDelete({ restaurant_id: restaurantId }).lean();
    if (!deleted) {
      return res.status(404).json({ detail: 'Restaurant not found' });
    }

    await deleteFoodsByRestaurant(restaurantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/customers/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const orderFilter = scope ? { 'restaurant.id': scope } : {};
    const [customers, orders, reviews] = await Promise.all([
      User.find({ role: 'customer' }).sort({ createdAt: -1 }).lean(),
      Order.find(orderFilter).lean(),
      Review.find().lean()
    ]);

    res.json({
      count: customers.length,
      results: customers.map(customer => {
        const customerOrders = orders.filter(order => order.user_id === customer.user_id);
        const customerReviews = reviews.filter(review => review.user_id === customer.user_id);
        const revenue = customerOrders
          .filter(order => order.status !== 'cancelled')
          .reduce((sum, order) => sum + Number(order.total || 0), 0);

        return {
          id: customer.user_id,
          name: `${customer.first_name} ${customer.last_name}`.trim(),
          email: customer.email,
          phone: customer.phone,
          status: customer.status,
          order_count: customerOrders.length,
          total_spent: Number(revenue.toFixed(2)),
          feedback_count: customerReviews.length,
          joined_at: customer.createdAt,
          recent_orders: customerOrders.slice(0, 3).map(order => serializeOrder(order, customer))
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

router.get('/delivery-personnel/', async (_req, res, next) => {
  try {
    const people = await DeliveryPerson.find().sort({ delivery_person_id: 1 }).lean();
    res.json({ count: people.length, results: people });
  } catch (error) {
    next(error);
  }
});

router.post('/delivery-personnel/', async (req, res, next) => {
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

router.put('/delivery-personnel/:id/', async (req, res, next) => {
  try {
    const updated = await DeliveryPerson.findOneAndUpdate(
      { delivery_person_id: Number(req.params.id) },
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
        ...(req.body.email !== undefined ? { email: req.body.email } : {}),
        ...(req.body.zone !== undefined ? { zone: req.body.zone } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.completed_deliveries !== undefined ? { completed_deliveries: Number(req.body.completed_deliveries) } : {}),
        ...(req.body.active_orders !== undefined ? { active_orders: Number(req.body.active_orders) } : {}),
        ...(req.body.rating !== undefined ? { rating: Number(req.body.rating) } : {})
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ detail: 'Delivery person not found' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/delivery-personnel/:id/', async (req, res, next) => {
  try {
    const deliveryPersonId = Number(req.params.id);
    const activeOrder = await Order.findOne({ assigned_delivery_person_id: deliveryPersonId, status: { $in: ['pending', 'preparing', 'delivering'] } }).lean();
    if (activeOrder) {
      return res.status(400).json({ detail: 'This delivery person is assigned to an active order.' });
    }

    const deleted = await DeliveryPerson.findOneAndDelete({ delivery_person_id: deliveryPersonId }).lean();
    if (!deleted) {
      return res.status(404).json({ detail: 'Delivery person not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/promotions/', async (_req, res, next) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 }).lean();
    res.json({ count: promotions.length, results: promotions });
  } catch (error) {
    next(error);
  }
});

router.post('/promotions/', async (req, res, next) => {
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
      usage_count: Number(req.body.usage_count || 0)
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put('/promotions/:id/', async (req, res, next) => {
  try {
    const updated = await Promotion.findOneAndUpdate(
      { promotion_id: Number(req.params.id) },
      {
        ...(req.body.code !== undefined ? { code: String(req.body.code).toUpperCase() } : {}),
        ...(req.body.title !== undefined ? { title: req.body.title } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.discount_type !== undefined ? { discount_type: req.body.discount_type } : {}),
        ...(req.body.discount_value !== undefined ? { discount_value: Number(req.body.discount_value) } : {}),
        ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {}),
        ...(req.body.starts_at !== undefined ? { starts_at: req.body.starts_at } : {}),
        ...(req.body.ends_at !== undefined ? { ends_at: req.body.ends_at } : {}),
        ...(req.body.usage_count !== undefined ? { usage_count: Number(req.body.usage_count) } : {})
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ detail: 'Promotion not found' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/promotions/:id/', async (req, res, next) => {
  try {
    const deleted = await Promotion.findOneAndDelete({ promotion_id: Number(req.params.id) }).lean();
    if (!deleted) {
      return res.status(404).json({ detail: 'Promotion not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/payments/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    const orderFilter = scope ? { 'restaurant.id': scope } : {};
    const orders = await Order.find(orderFilter).sort({ createdAt: -1 }).lean();
    res.json({
      count: orders.length,
      results: orders.map(order => ({
        id: order.order_id,
        order_id: order.order_id,
        user_id: order.user_id,
        gateway: order.paymentGateway || 'Cash on Delivery',
        method: order.paymentMethod || 'cash',
        status: order.paymentStatus || 'pending',
        amount: Number(order.total || 0),
        refund_amount: Number(order.refundAmount || 0),
        transaction_reference: order.transactionReference || '',
        created_at: order.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/payments/:id/refund/', async (req, res, next) => {
  try {
    const scope = adminScope(req.user);
    if (scope) {
      const order = await Order.findOne({ order_id: req.params.id }).lean();
      if (!order || order.restaurant?.id !== scope) {
        return res.status(403).json({ detail: 'Access denied: order belongs to a different restaurant.' });
      }
    }
    const refundAmount = Number(req.body.refund_amount || 0);
    const updated = await Order.findOneAndUpdate(
      { order_id: req.params.id },
      {
        paymentStatus: refundAmount > 0 ? 'refunded' : 'paid',
        refundAmount
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ detail: 'Payment record not found' });
    }

    res.json({
      id: updated.order_id,
      status: updated.paymentStatus,
      refund_amount: updated.refundAmount,
      transaction_reference: updated.transactionReference || ''
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Superadmin-only routes
// These sit under /api/admin but use requireSuperAdmin, NOT
// requireAdmin, so they bypass the blanket requireAdmin applied
// to the whole router via router.use(requireAuth, requireAdmin).
// We re-apply requireAuth inline since the router-level one
// covers the requireAdmin check which would reject superadmins.
// Solution: add requireSuperAdmin *after* requireAuth.
// ============================================================

// Partner Applications
router.get('/applications', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const status = req.query.status;
    const result = await listPartnerApplications(status);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/applications/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const app = await getApplicationById(req.params.id);
    res.json(app);
  } catch (error) {
    next(error);
  }
});

router.post('/applications/:id/approve', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await approveApplication(req.params.id);
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'approve_application',
      target_id: Number(req.params.id),
      target_type: 'application',
      note: `Approved application for ${result.restaurant.name}`
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/applications/:id/reject', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await rejectApplication(req.params.id, req.body.reason || '');
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'reject_application',
      target_id: Number(req.params.id),
      target_type: 'application',
      note: req.body.reason ? `Reason: ${req.body.reason}` : ''
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Superadmin restaurant management
router.get('/superadmin/restaurants', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await listAllRestaurantsAdmin();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/restaurants/:id/restrict', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const restricted = req.body.restricted !== undefined ? Boolean(req.body.restricted) : true;
    const updated = await restrictRestaurant(req.params.id, restricted);
    await createAuditLog({
      actor_id: req.user.user_id,
      action: restricted ? 'restrict_restaurant' : 'unrestrict_restaurant',
      target_id: Number(req.params.id),
      target_type: 'restaurant',
      note: `Restaurant: ${updated.name}`
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/superadmin/restaurants/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    await deleteRestaurantAdmin(req.params.id);
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'delete_restaurant',
      target_id: Number(req.params.id),
      target_type: 'restaurant',
      note: ''
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Superadmin user management
router.get('/superadmin/users', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const result = await listAllUsers(req.query.search);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/superadmin/users/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const user = await getSuperadminUserById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/users/:id/ban', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const user = await getSuperadminUserById(req.params.id);
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot ban a superadmin account.' });
    }
    const updated = await banUser(req.params.id, req.body.reason || '');
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'ban_user',
      target_id: Number(req.params.id),
      target_type: 'user',
      note: req.body.reason ? `Reason: ${req.body.reason}` : ''
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/users/:id/unban', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const updated = await unbanUser(req.params.id);
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'unban_user',
      target_id: Number(req.params.id),
      target_type: 'user',
      note: ''
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/users/:id/reset-password', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const user = await getSuperadminUserById(req.params.id);
    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot reset a superadmin password from this interface.' });
    }
    await adminResetPassword(req.params.id, req.body.newPassword);
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'reset_password',
      target_id: Number(req.params.id),
      target_type: 'user',
      note: `Password reset for ${user.email}`
    });
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
});

// Superadmin platform analytics
router.get('/superadmin/analytics', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const analytics = await getPlatformAnalytics();
    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

// Superadmin audit log
router.get('/superadmin/audit-log', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await listAuditLogs({ page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ---- Global Promotions (superadmin) ----

router.get('/superadmin/promotions', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json(await listGlobalPromos());
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/promotions', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const promo = await createGlobalPromo({
      code: req.body.code,
      type: req.body.type,
      value: req.body.value,
      min_order: req.body.min_order,
      max_uses: req.body.max_uses,
      expires_at: req.body.expires_at,
      created_by: req.user.user_id
    });
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'create_global_promo',
      target_id: promo.promo_id,
      target_type: 'global_promo',
      note: `Created promo code ${promo.code}`
    });
    res.status(201).json(promo);
  } catch (error) {
    next(error);
  }
});

router.patch('/superadmin/promotions/:id/toggle', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const promo = await toggleGlobalPromo(Number(req.params.id));
    res.json(promo);
  } catch (error) {
    next(error);
  }
});

router.delete('/superadmin/promotions/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    await deleteGlobalPromo(Number(req.params.id));
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'delete_global_promo',
      target_id: Number(req.params.id),
      target_type: 'global_promo',
      note: `Deleted global promo #${req.params.id}`
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// --- Superadmin: Category Management ---

router.get('/superadmin/categories', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const data = await listCategories();
    // Attach food counts in parallel
    const withCounts = await Promise.all(
      data.results.map(async cat => ({
        ...cat,
        foods_count: await getCategoryFoodCount(cat.category_id)
      }))
    );
    res.json({ count: withCounts.length, results: withCounts });
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/categories', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const category = await createCategory({ name: req.body.name });
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'create_category',
      target_id: category.category_id,
      target_type: 'category',
      note: `Created category "${category.name}"`
    });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

router.patch('/superadmin/categories/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const category = await updateCategory(Number(req.params.id), { name: req.body.name });
    res.json(category);
  } catch (error) {
    next(error);
  }
});

router.patch('/superadmin/categories/:id/toggle', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const category = await toggleCategory(Number(req.params.id));
    res.json(category);
  } catch (error) {
    next(error);
  }
});

router.delete('/superadmin/categories/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    await deleteCategory(Number(req.params.id));
    await createAuditLog({
      actor_id: req.user.user_id,
      action: 'delete_category',
      target_id: Number(req.params.id),
      target_type: 'category',
      note: `Deleted category #${req.params.id}`
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;



