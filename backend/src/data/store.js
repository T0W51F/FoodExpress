import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import {
  AuditLog,
  Cart,
  Category,
  DeliveryPerson,
  Food,
  GlobalPromotion,
  Order,
  PartnerApplication,
  Promotion,
  RefreshToken,
  Restaurant,
  Review,
  User
} from '../models/index.js';
import { getNextSequence } from '../utils/counters.js';
import { serializeRestaurant, serializeFood, serializePartnerApplication, serializeUser, serializeAuditLog, serializeGlobalPromo, serializeCategory } from '../utils/formatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDataDir = path.resolve(__dirname, '../../../frontend/data');

function readJson(fileName) {
  const filePath = path.join(frontendDataDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function publicUser(user) {
  return {
    id: user.user_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
    role: user.role || 'customer',
    restaurant_id: user.restaurant_id || null,
    status: user.status || 'active'
  };
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.user_id, email: user.email, role: user.role || 'customer', type: 'access' },
    config.accessSecret,
    { expiresIn: '1d' }
  );
}

async function signRefreshToken(user) {
  const token = jwt.sign(
    { sub: user.user_id, email: user.email, role: user.role || 'customer', type: 'refresh' },
    config.refreshSecret,
    { expiresIn: '7d' }
  );
  const payload = jwt.decode(token);
  await RefreshToken.findOneAndUpdate(
    { token },
    {
      token,
      user_id: user.user_id,
      expires_at: new Date(payload.exp * 1000)
    },
    { upsert: true, new: true }
  );
  return token;
}

function inferPaymentGateway(paymentMethod = 'cash') {
  const normalized = String(paymentMethod || 'cash').toLowerCase();
  if (normalized === 'card') {
    return 'Stripe';
  }
  if (normalized === 'bkash' || normalized === 'mobile') {
    return 'bKash';
  }
  return 'Cash on Delivery';
}

function inferPaymentStatus(paymentMethod = 'cash') {
  const normalized = String(paymentMethod || 'cash').toLowerCase();
  return normalized === 'cash' ? 'pending' : 'paid';
}

function serializeOrder(order) {
  return {
    id: order.order_id,
    user_id: order.user_id,
    status: order.status,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    tax: order.tax,
    total: order.total,
    address: order.address,
    paymentMethod: order.paymentMethod,
    paymentGateway: order.paymentGateway,
    paymentStatus: order.paymentStatus,
    refundAmount: order.refundAmount || 0,
    transactionReference: order.transactionReference || '',
    cancellation_reason: order.cancellation_reason || '',
    assigned_delivery_person_id: order.assigned_delivery_person_id || null,
    assigned_delivery_person_name: order.assigned_delivery_person_name || '',
    restaurant: order.restaurant,
    created_at: order.createdAt,
    updated_at: order.updatedAt
  };
}

export async function buildAuthPayload(user) {
  return {
    user: publicUser(user),
    access: signAccessToken(user),
    refresh: await signRefreshToken(user)
  };
}

export async function createUser(payload) {
  if (!payload.email || !String(payload.email).trim()) {
    const error = new Error('email is required');
    error.status = 400;
    throw error;
  }
  if (!payload.password || !String(payload.password).trim()) {
    const error = new Error('password is required');
    error.status = 400;
    throw error;
  }
  if (!payload.first_name || !String(payload.first_name).trim()) {
    const error = new Error('first_name is required');
    error.status = 400;
    throw error;
  }

  const existingUser = await User.findOne({ email: String(payload.email).toLowerCase() });
  if (existingUser) {
    const error = new Error('A user with that email already exists.');
    error.status = 400;
    throw error;
  }

  const allowedRoles = ['customer', 'admin', 'restaurant_admin', 'superadmin'];
  const role = allowedRoles.includes(payload.role) ? payload.role : 'customer';
  const user = await User.create({
    user_id: await getNextSequence('users'),
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: String(payload.email).toLowerCase(),
    phone: payload.phone || '',
    password_hash: await bcrypt.hash(payload.password, 10),
    role,
    restaurant_id: payload.restaurant_id ? Number(payload.restaurant_id) : null,
    status: 'active'
  });

  return user;
}

export async function authenticateUser(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  return user;
}

export async function refreshAccessToken(token) {
  const refreshRecord = await RefreshToken.findOne({ token });
  if (!refreshRecord) {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }

  const payload = jwt.verify(token, config.refreshSecret);
  const user = await User.findOne({ user_id: Number(payload.sub) });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  return { access: signAccessToken(user) };
}

export async function revokeRefreshToken(token) {
  await RefreshToken.deleteOne({ token });
}

export async function getUserById(id) {
  return User.findOne({ user_id: Number(id) });
}

export async function updateUserProfile(userId, updates) {
  if (updates.first_name !== undefined) {
    if (!updates.first_name || !String(updates.first_name).trim()) {
      const error = new Error('first_name must be a non-empty string');
      error.status = 400;
      throw error;
    }
  }
  if (updates.email !== undefined) {
    const error = new Error('Email cannot be changed. Contact support to update your email address.');
    error.status = 400;
    throw error;
  }

  const user = await User.findOneAndUpdate(
    { user_id: Number(userId) },
    {
      ...(updates.first_name !== undefined ? { first_name: String(updates.first_name).trim() } : {}),
      ...(updates.last_name !== undefined ? { last_name: updates.last_name } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {})
    },
    { new: true }
  );

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  return publicUser(user);
}

export async function listRestaurants(query = {}) {
  const search = String(query.search || query.q || '').trim();
  const baseFilter = { restricted: { $ne: true } };
  const filter = search
    ? {
        ...baseFilter,
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { cuisine: { $regex: search, $options: 'i' } },
          { categories: { $elemMatch: { $regex: search, $options: 'i' } } }
        ]
      }
    : baseFilter;

  const items = await Restaurant.find(filter).sort({ restaurant_id: 1 }).lean();
  return {
    count: items.length,
    results: items.map(serializeRestaurant)
  };
}

export async function listFeaturedRestaurants() {
  const items = await Restaurant.find({ featured: true, restricted: { $ne: true } }).sort({ restaurant_id: 1 }).lean();
  return {
    count: items.length,
    results: items.map(serializeRestaurant)
  };
}

export async function getRestaurantById(id) {
  const restaurant = await Restaurant.findOne({ restaurant_id: Number(id) }).lean();
  if (!restaurant) {
    const error = new Error('Restaurant not found');
    error.status = 404;
    throw error;
  }

  return serializeRestaurant(restaurant);
}

export async function getFoodsByRestaurantId(restaurantId) {
  const items = await Food.find({ restaurant_id: Number(restaurantId) }).sort({ food_id: 1 }).lean();
  return {
    count: items.length,
    results: items.map(serializeFood)
  };
}

export async function listFoods(query = {}) {
  const filter = {};

  if (String(query.popular).toLowerCase() === 'true') {
    filter.popular = true;
  }

  if (query.restaurant_id) {
    filter.restaurant_id = Number(query.restaurant_id);
  }

  const items = await Food.find(filter).sort({ food_id: 1 }).lean();
  return {
    count: items.length,
    results: items.map(serializeFood)
  };
}

export async function getFoodById(id) {
  const food = await Food.findOne({ food_id: Number(id) }).lean();
  if (!food) {
    const error = new Error('Food item not found');
    error.status = 404;
    throw error;
  }
  return serializeFood(food);
}

export async function searchRestaurants(query) {
  return listRestaurants({ q: query });
}

export async function addReview(review) {
  if (review.rating === undefined || review.rating === null || review.rating === '') {
    const error = new Error('rating is required');
    error.status = 400;
    throw error;
  }
  const ratingNum = Number(review.rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    const error = new Error('rating must be between 1 and 5');
    error.status = 400;
    throw error;
  }

  const createdReview = await Review.create({
    review_id: await getNextSequence('reviews'),
    user_id: Number(review.user_id),
    restaurant_id: review.restaurant_id ? Number(review.restaurant_id) : undefined,
    food_id: review.food_id ? Number(review.food_id) : undefined,
    rating: Number(review.rating || 0),
    comment: review.comment || ''
  });

  return {
    id: createdReview.review_id,
    user_id: createdReview.user_id,
    restaurant_id: createdReview.restaurant_id,
    food_id: createdReview.food_id,
    rating: createdReview.rating,
    comment: createdReview.comment,
    created_at: createdReview.createdAt
  };
}

export async function getCart(userId) {
  const cart = await Cart.findOne({ user_id: Number(userId) }).lean();
  return cart || { user_id: Number(userId), items: [] };
}

export async function saveCart(userId, cart) {
  const items = Array.isArray(cart.items) ? cart.items : Array.isArray(cart) ? cart : [];
  const saved = await Cart.findOneAndUpdate(
    { user_id: Number(userId) },
    { user_id: Number(userId), items },
    { new: true, upsert: true }
  ).lean();

  return saved;
}

export async function listOrders(userId) {
  const results = await Order.find({ user_id: Number(userId) }).sort({ createdAt: -1 }).lean();
  return {
    count: results.length,
    results: results.map(serializeOrder)
  };
}

export async function createOrder(userId, payload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    const error = new Error('order must contain at least one item');
    error.status = 400;
    throw error;
  }
  if (!payload.address || !String(payload.address).trim()) {
    const error = new Error('delivery address is required');
    error.status = 400;
    throw error;
  }

  // Fetch authoritative prices from DB — never trust client-supplied totals
  const foodIds = payload.items.map(item => Number(item.food_id));
  const foods = await Food.find({ food_id: { $in: foodIds } }).lean();
  const foodMap = new Map(foods.map(f => [f.food_id, f]));

  let computedSubtotal = 0;
  const verifiedItems = [];
  for (const item of payload.items) {
    const food = foodMap.get(Number(item.food_id));
    if (!food) {
      const error = new Error(`Invalid item: food_id ${item.food_id} not found`);
      error.status = 400;
      throw error;
    }
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      const error = new Error('quantity must be a positive integer');
      error.status = 400;
      throw error;
    }
    if (qty > 20) {
      const error = new Error('quantity cannot exceed 20 per item');
      error.status = 400;
      throw error;
    }
    computedSubtotal += food.price * qty;
    verifiedItems.push({ ...item, quantity: qty, price: food.price, name: food.name, totalPrice: Math.round(food.price * qty * 100) / 100 });
  }
  computedSubtotal = Number(computedSubtotal.toFixed(2));
  const deliveryFee = computedSubtotal >= 20 ? 0 : 2.99;
  const tax = Number(Number((computedSubtotal * 0.05).toFixed(2)));
  let computedTotal = Number((computedSubtotal + deliveryFee + tax).toFixed(2));

  // Apply global promo discount first if a promo code is provided
  let appliedGlobalPromoId = null;
  let globalPromoDiscount = 0;
  if (payload.promo_code) {
    try {
      const promoResult = await validateGlobalPromo(payload.promo_code, computedSubtotal);
      globalPromoDiscount = promoResult.discount_amount;
      appliedGlobalPromoId = promoResult.promo_id;
      computedTotal = Number(Math.max(0, computedTotal - globalPromoDiscount).toFixed(2));
    } catch (promoErr) {
      // If the global promo fails validation, treat it silently — the frontend already
      // validated it; a race condition (e.g. promo used up between validate and order) is
      // the only realistic path here. Do not fail the order.
    }
  }

  const paymentMethod = payload.paymentMethod || 'cash';
  const paymentGateway = inferPaymentGateway(paymentMethod);
  const paymentStatus = payload.paymentStatus || inferPaymentStatus(paymentMethod);
  const transactionReference = payload.transactionReference || `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const createdOrder = await Order.create({
    order_id: crypto.randomUUID(),
    user_id: Number(userId),
    status: payload.status || 'pending',
    items: verifiedItems,
    subtotal: computedSubtotal,
    deliveryFee,
    tax,
    total: computedTotal,
    address: payload.address || '',
    paymentMethod,
    paymentGateway,
    paymentStatus,
    refundAmount: payload.refundAmount || 0,
    transactionReference,
    cancellation_reason: payload.cancellation_reason || '',
    assigned_delivery_person_id: payload.assigned_delivery_person_id || null,
    assigned_delivery_person_name: payload.assigned_delivery_person_name || '',
    restaurant: payload.restaurant || null
  });

  // Atomically increment the global promo usage counter after the order is saved
  if (appliedGlobalPromoId !== null) {
    await applyGlobalPromo(appliedGlobalPromoId);
  }

  await Cart.findOneAndUpdate(
    { user_id: Number(userId) },
    { user_id: Number(userId), items: [] },
    { new: true, upsert: true }
  );

  return serializeOrder(createdOrder);
}

export async function getOrderById(userId, orderId) {
  const order = await Order.findOne({ user_id: Number(userId), order_id: String(orderId) }).lean();
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  return serializeOrder(order);
}

export async function seedRestaurantAndFoodData() {
  const restaurantsJson = readJson('restaurants.json');
  const foodsJson = readJson('foods.json');

  const restaurants = Array.isArray(restaurantsJson)
    ? restaurantsJson
    : (restaurantsJson.restaurants || []);
  const foods = Array.isArray(foodsJson)
    ? foodsJson
    : (foodsJson.foods || []);

  const restaurantIds = restaurants.map(restaurant => restaurant.id);
  const foodIds = foods.map(food => food.id);

  await Restaurant.deleteMany({ restaurant_id: { $nin: restaurantIds } });
  await Food.deleteMany({ food_id: { $nin: foodIds } });

  for (const restaurant of restaurants) {
    await Restaurant.findOneAndUpdate(
      { restaurant_id: restaurant.id },
      {
        restaurant_id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        delivery_time: restaurant.delivery_time,
        rating: restaurant.rating,
        reviews: restaurant.reviews,
        delivery_fee: restaurant.delivery_fee,
        min_order: restaurant.min_order,
        image: restaurant.image,
        featured: Boolean(restaurant.featured),
        is_open: Boolean(restaurant.is_open),
        categories: restaurant.categories || [],
        operating_hours: restaurant.operating_hours || '10:00 AM - 11:00 PM',
        contact_phone: restaurant.contact_phone || '+8801700000000',
        contact_email: restaurant.contact_email || 'hello@foodexpress.com',
        service_area: restaurant.service_area || 'Gulshan, Banani, Baridhara'
      },
      { upsert: true, new: true }
    );
  }

  for (const food of foods) {
    await Food.findOneAndUpdate(
      { food_id: food.id },
      {
        food_id: food.id,
        restaurant_id: food.restaurant_id,
        name: food.name,
        description: food.description,
        price: food.price,
        image: food.image,
        category: food.category,
        vegetarian: Boolean(food.vegetarian),
        spicy_level: food.spicy_level,
        rating: food.rating,
        popular: Boolean(food.popular),
        addons: food.addons || []
      },
      { upsert: true, new: true }
    );
  }
}

export async function validatePromoCode(code, subtotal) {
  const normalizedCode = String(code).toUpperCase().trim();
  const promo = await Promotion.findOne({ code: normalizedCode }).lean();

  if (!promo) {
    // Fall back to global promotions
    return validateGlobalPromo(normalizedCode, subtotal);
  }

  if (!promo.active) {
    const error = new Error('This promo code is no longer active');
    error.status = 400;
    throw error;
  }

  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    const error = new Error('This promo code is not yet valid');
    error.status = 400;
    throw error;
  }

  if (promo.ends_at && new Date(promo.ends_at) < now) {
    const error = new Error('This promo code has expired');
    error.status = 400;
    throw error;
  }

  const sub = Number(subtotal || 0);
  let discountAmount = 0;

  if (promo.discount_type === 'percentage') {
    discountAmount = Number(((sub * promo.discount_value) / 100).toFixed(2));
  } else {
    discountAmount = Number(Math.min(promo.discount_value, sub).toFixed(2));
  }

  return {
    scope: 'restaurant',
    code: promo.code,
    title: promo.title,
    description: promo.description,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    discount_amount: discountAmount
  };
}

export async function listMenuItems(query = {}) {
  const filter = {};
  if (query.restaurant_id) {
    filter.restaurant_id = Number(query.restaurant_id);
  }
  if (query.category) {
    filter.category = query.category;
  }
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const items = await Food.find(filter).sort({ food_id: 1 }).lean();
  return { count: items.length, results: items.map(serializeFood) };
}

export async function createFood(data) {
  if (!data.name || !String(data.name).trim()) {
    const error = new Error('name is required');
    error.status = 400;
    throw error;
  }
  if (data.price === undefined || data.price === null || data.price === '') {
    const error = new Error('price is required');
    error.status = 400;
    throw error;
  }
  if (!data.restaurant_id) {
    const error = new Error('restaurant_id is required');
    error.status = 400;
    throw error;
  }
  const restaurant = await Restaurant.findOne({ restaurant_id: Number(data.restaurant_id) });
  if (!restaurant) {
    const err = new Error(`Restaurant with id ${data.restaurant_id} not found`);
    err.status = 400;
    throw err;
  }

  const created = await Food.create({
    food_id: await getNextSequence('foods'),
    restaurant_id: Number(data.restaurant_id),
    name: String(data.name).trim(),
    description: data.description || '',
    price: Number(data.price),
    image: data.image || '',
    category: String(data.category || '').trim(),
    category_id: data.category_id != null ? Number(data.category_id) : null,
    vegetarian: Boolean(data.vegetarian),
    spicy_level: Number(data.spicy_level || 0),
    rating: Number(data.rating || 0),
    popular: Boolean(data.popular),
    addons: Array.isArray(data.addons) ? data.addons : []
  });

  return serializeFood(created.toObject());
}

export async function updateFood(id, data) {
  if (data.name !== undefined && !String(data.name).trim()) {
    const error = new Error('name must be a non-empty string');
    error.status = 400;
    throw error;
  }
  if (data.price !== undefined) {
    const parsedPrice = Number(data.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      const error = new Error('price must be a positive number');
      error.status = 400;
      throw error;
    }
  }
  if (data.restaurant_id !== undefined) {
    const restaurant = await Restaurant.findOne({ restaurant_id: Number(data.restaurant_id) });
    if (!restaurant) {
      const err = new Error(`Restaurant with id ${data.restaurant_id} not found`);
      err.status = 400;
      throw err;
    }
  }

  const patch = {};
  if (data.restaurant_id !== undefined) patch.restaurant_id = Number(data.restaurant_id);
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.description !== undefined) patch.description = data.description;
  if (data.price !== undefined) patch.price = Number(data.price);
  if (data.image !== undefined) patch.image = data.image;
  if (data.category !== undefined) patch.category = String(data.category).trim();
  if (data.category_id !== undefined) patch.category_id = data.category_id != null ? Number(data.category_id) : null;
  if (data.vegetarian !== undefined) patch.vegetarian = Boolean(data.vegetarian);
  if (data.spicy_level !== undefined) patch.spicy_level = Number(data.spicy_level);
  if (data.rating !== undefined) patch.rating = Number(data.rating);
  if (data.popular !== undefined) patch.popular = Boolean(data.popular);
  if (data.addons !== undefined) patch.addons = Array.isArray(data.addons) ? data.addons : [];

  const updated = await Food.findOneAndUpdate(
    { food_id: Number(id) },
    patch,
    { new: true }
  ).lean();

  if (!updated) {
    const error = new Error('Menu item not found');
    error.status = 404;
    throw error;
  }

  return serializeFood(updated);
}

export async function deleteFood(id) {
  const deleted = await Food.findOneAndDelete({ food_id: Number(id) }).lean();
  if (!deleted) {
    const error = new Error('Menu item not found');
    error.status = 404;
    throw error;
  }
}

export async function deleteFoodsByRestaurant(restaurantId) {
  await Food.deleteMany({ restaurant_id: Number(restaurantId) });
}

// --- Partner Applications ---

export async function submitPartnerApplication(data) {
  if (!data.business_name || !String(data.business_name).trim()) {
    const error = new Error('business_name is required');
    error.status = 400;
    throw error;
  }
  if (!data.contact_name || !String(data.contact_name).trim()) {
    const error = new Error('contact_name is required');
    error.status = 400;
    throw error;
  }
  if (!data.email || !String(data.email).trim()) {
    const error = new Error('email is required');
    error.status = 400;
    throw error;
  }
  if (!data.phone || !String(data.phone).trim()) {
    const error = new Error('phone is required');
    error.status = 400;
    throw error;
  }
  if (!data.address || !String(data.address).trim()) {
    const error = new Error('address is required');
    error.status = 400;
    throw error;
  }

  const existing = await PartnerApplication.findOne({ email: String(data.email).toLowerCase().trim() });
  if (existing) {
    const error = new Error('An application with this email already exists');
    error.status = 400;
    throw error;
  }

  const app = await PartnerApplication.create({
    application_id: await getNextSequence('applications'),
    business_name: String(data.business_name).trim(),
    contact_name: String(data.contact_name).trim(),
    email: String(data.email).toLowerCase().trim(),
    phone: String(data.phone).trim(),
    address: String(data.address).trim(),
    description: data.description || '',
    status: 'pending',
    // Link the application to the logged-in user so approval can target
    // the right account directly instead of matching by email.
    user_id: data.user_id != null ? Number(data.user_id) : null
  });

  return serializePartnerApplication(app.toObject());
}

export async function listPartnerApplications(status) {
  const filter = status ? { status } : {};
  const apps = await PartnerApplication.find(filter).sort({ createdAt: -1 }).lean();
  return {
    count: apps.length,
    results: apps.map(serializePartnerApplication)
  };
}

export async function getApplicationById(application_id) {
  const app = await PartnerApplication.findOne({ application_id: Number(application_id) }).lean();
  if (!app) {
    const error = new Error('Application not found');
    error.status = 404;
    throw error;
  }
  return serializePartnerApplication(app);
}

export async function getApplicationByEmail(email) {
  const app = await PartnerApplication.findOne({ email: String(email).toLowerCase().trim() }).lean();
  if (!app) {
    const error = new Error('No application found for this email');
    error.status = 404;
    throw error;
  }
  return serializePartnerApplication(app);
}

export async function approveApplication(application_id) {
  const app = await PartnerApplication.findOne({ application_id: Number(application_id) });
  if (!app) {
    const error = new Error('Application not found');
    error.status = 404;
    throw error;
  }
  if (app.status !== 'pending') {
    const error = new Error(`Application is already ${app.status}`);
    error.status = 400;
    throw error;
  }

  // Generate a temporary password
  const tempPassword = `FDP-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  // Build a username slug from business name
  const slug = app.business_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20);

  // Create the Restaurant document
  const restaurant = await Restaurant.create({
    restaurant_id: await getNextSequence('restaurants'),
    name: app.business_name,
    cuisine: 'Various',
    delivery_time: '30-45 min',
    rating: 0,
    reviews: 0,
    delivery_fee: 2.99,
    min_order: 5,
    image: '',
    featured: false,
    is_open: true,
    categories: [],
    operating_hours: '10:00 AM - 11:00 PM',
    contact_phone: app.phone,
    contact_email: app.email,
    service_area: app.address,
    description: app.description || '',
    restricted: false
  });

  // Resolve or create the restaurant_admin User.
  // If the application was submitted by a logged-in user (app.user_id is set),
  // upgrade that existing account rather than creating a duplicate.
  let adminUser;
  let isNewUser = false;

  if (app.user_id) {
    adminUser = await User.findOne({ user_id: app.user_id });
  }

  if (adminUser) {
    // Upgrade the existing account in-place
    adminUser.role = 'restaurant_admin';
    adminUser.restaurant_id = restaurant.restaurant_id;
    // Update contact details from the application if they have changed
    if (!adminUser.phone && app.phone) {
      adminUser.phone = app.phone;
    }
    await adminUser.save();
  } else {
    // Fall back: create a brand-new account (legacy path for applications
    // submitted before user linking was introduced, or by unauthenticated users)
    isNewUser = true;
    adminUser = await User.create({
      user_id: await getNextSequence('users'),
      first_name: app.contact_name.split(' ')[0] || app.contact_name,
      last_name: app.contact_name.split(' ').slice(1).join(' ') || '',
      email: app.email,
      phone: app.phone,
      password_hash: await bcrypt.hash(tempPassword, 10),
      role: 'restaurant_admin',
      restaurant_id: restaurant.restaurant_id,
      status: 'active'
    });
  }

  // Update the application
  app.status = 'approved';
  app.user_id = adminUser.user_id;
  app.restaurant_id = restaurant.restaurant_id;
  await app.save();

  return {
    application: serializePartnerApplication(app.toObject()),
    restaurant: serializeRestaurant(restaurant.toObject()),
    user: publicUser(adminUser),
    // Only emit temp_password when a new account was created so the
    // superadmin knows to communicate it; existing users keep their password
    temp_password: isNewUser ? tempPassword : null
  };
}

export async function rejectApplication(application_id, reason) {
  const app = await PartnerApplication.findOne({ application_id: Number(application_id) });
  if (!app) {
    const error = new Error('Application not found');
    error.status = 404;
    throw error;
  }
  if (app.status !== 'pending') {
    const error = new Error(`Application is already ${app.status}`);
    error.status = 400;
    throw error;
  }

  app.status = 'rejected';
  app.rejection_reason = reason || '';
  await app.save();

  return serializePartnerApplication(app.toObject());
}

// --- Restaurant Admin ---

export async function getRestaurantAdminDashboard(restaurant_id) {
  const [restaurant, foods, orders] = await Promise.all([
    Restaurant.findOne({ restaurant_id: Number(restaurant_id) }).lean(),
    Food.find({ restaurant_id: Number(restaurant_id) }).lean(),
    Order.find({ 'restaurant.id': Number(restaurant_id) }).sort({ createdAt: -1 }).lean()
  ]);

  if (!restaurant) {
    const error = new Error('Restaurant not found');
    error.status = 404;
    throw error;
  }

  const ordersByStatus = { pending: 0, preparing: 0, delivering: 0, delivered: 0, cancelled: 0 };
  let totalRevenue = 0;
  orders.forEach(order => {
    const s = order.status || 'pending';
    if (ordersByStatus[s] !== undefined) ordersByStatus[s] += 1;
    if (s !== 'cancelled') totalRevenue += Number(order.total || 0);
  });

  return {
    restaurant: serializeRestaurant(restaurant),
    stats: {
      total_foods: foods.length,
      total_orders: orders.length,
      active_orders: ordersByStatus.pending + ordersByStatus.preparing + ordersByStatus.delivering,
      total_revenue: Number(totalRevenue.toFixed(2)),
      order_status_breakdown: ordersByStatus
    },
    recent_orders: orders.slice(0, 5).map(o => ({
      id: o.order_id,
      status: o.status,
      total: o.total,
      items: o.items || [],
      created_at: o.createdAt
    }))
  };
}

export async function getRestaurantFoods(restaurant_id) {
  const items = await Food.find({ restaurant_id: Number(restaurant_id) }).sort({ food_id: 1 }).lean();
  return { count: items.length, results: items.map(serializeFood) };
}

export async function createRestaurantFood(restaurant_id, data) {
  return createFood({ ...data, restaurant_id: Number(restaurant_id) });
}

export async function updateRestaurantFood(food_id, restaurant_id, data) {
  const item = await Food.findOne({ food_id: Number(food_id) }).lean();
  if (!item) {
    const error = new Error('Food item not found');
    error.status = 404;
    throw error;
  }
  if (item.restaurant_id !== Number(restaurant_id)) {
    const error = new Error('Access denied: this item belongs to a different restaurant');
    error.status = 403;
    throw error;
  }
  // Strip restaurant_id from update data — ownership is verified
  const safeData = { ...data };
  delete safeData.restaurant_id;
  return updateFood(food_id, safeData);
}

export async function deleteRestaurantFood(food_id, restaurant_id) {
  const item = await Food.findOne({ food_id: Number(food_id) }).lean();
  if (!item) {
    const error = new Error('Food item not found');
    error.status = 404;
    throw error;
  }
  if (item.restaurant_id !== Number(restaurant_id)) {
    const error = new Error('Access denied: this item belongs to a different restaurant');
    error.status = 403;
    throw error;
  }
  return deleteFood(food_id);
}

export async function getRestaurantOrders(restaurant_id) {
  const orders = await Order.find({ 'restaurant.id': Number(restaurant_id) }).sort({ createdAt: -1 }).lean();
  return {
    count: orders.length,
    results: orders.map(o => ({
      id: o.order_id,
      order_id: o.order_id,
      user_id: o.user_id,
      status: o.status,
      items: o.items || [],
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      tax: o.tax,
      total: o.total,
      address: o.address,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      created_at: o.createdAt
    }))
  };
}

export async function updateRestaurantProfile(restaurant_id, data) {
  const allowedFields = ['name', 'cuisine', 'delivery_time', 'delivery_fee', 'min_order',
    'image', 'is_open', 'categories', 'operating_hours', 'contact_phone',
    'contact_email', 'service_area', 'description'];

  const patch = {};
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      patch[field] = data[field];
    }
  }

  const updated = await Restaurant.findOneAndUpdate(
    { restaurant_id: Number(restaurant_id) },
    patch,
    { new: true }
  ).lean();

  if (!updated) {
    const error = new Error('Restaurant not found');
    error.status = 404;
    throw error;
  }

  return serializeRestaurant(updated);
}

// --- Superadmin ---

export async function listAllRestaurantsAdmin() {
  const restaurants = await Restaurant.find().sort({ restaurant_id: 1 }).lean();
  return { count: restaurants.length, results: restaurants.map(serializeRestaurant) };
}

export async function restrictRestaurant(restaurant_id, restricted) {
  const updated = await Restaurant.findOneAndUpdate(
    { restaurant_id: Number(restaurant_id) },
    { restricted: Boolean(restricted) },
    { new: true }
  ).lean();

  if (!updated) {
    const error = new Error('Restaurant not found');
    error.status = 404;
    throw error;
  }

  return serializeRestaurant(updated);
}

export async function deleteRestaurantAdmin(restaurant_id) {
  const deleted = await Restaurant.findOneAndDelete({ restaurant_id: Number(restaurant_id) }).lean();
  if (!deleted) {
    const error = new Error('Restaurant not found');
    error.status = 404;
    throw error;
  }
  await Food.deleteMany({ restaurant_id: Number(restaurant_id) });
}

// --- Superadmin: User Management ---

export async function listAllUsers(search) {
  const filter = {};
  if (search && String(search).trim()) {
    const regex = { $regex: String(search).trim(), $options: 'i' };
    filter.$or = [
      { first_name: regex },
      { last_name: regex },
      { email: regex }
    ];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).lean();
  return { count: users.length, results: users.map(serializeUser) };
}

export async function getSuperadminUserById(user_id) {
  const user = await User.findOne({ user_id: Number(user_id) }).lean();
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return serializeUser(user);
}

export async function banUser(user_id, reason) {
  const updated = await User.findOneAndUpdate(
    { user_id: Number(user_id) },
    { banned: true, ban_reason: String(reason || '').trim() },
    { new: true }
  ).lean();
  if (!updated) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return serializeUser(updated);
}

export async function unbanUser(user_id) {
  const updated = await User.findOneAndUpdate(
    { user_id: Number(user_id) },
    { banned: false, ban_reason: '' },
    { new: true }
  ).lean();
  if (!updated) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return serializeUser(updated);
}

export async function getPlatformAnalytics() {
  const now = new Date();

  // Build the last-6-months window (inclusive of the current month)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
    });
  }

  // Run all heavy queries in parallel
  const [
    totalOrdersCount,
    revenueAgg,
    restaurantOrderAgg,
    allRestaurants,
    totalUsersCount,
    userGrowthDocs
  ] = await Promise.all([
    // 1. Total order count
    Order.countDocuments({}),

    // 2. Revenue from non-cancelled orders
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),

    // 3. Order count per restaurant (for top-5)
    Order.aggregate([
      { $match: { 'restaurant.id': { $exists: true, $ne: null } } },
      { $group: { _id: '$restaurant.id', order_count: { $sum: 1 } } },
      { $sort: { order_count: -1 } },
      { $limit: 5 }
    ]),

    // 4. All restaurants (to resolve names)
    Restaurant.find({}, { restaurant_id: 1, name: 1 }).lean(),

    // 5. Total user count (excluding superadmin service accounts)
    User.countDocuments({}),

    // 6. User signups per month for the last 6 months
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: months[0].start, $lte: months[months.length - 1].end }
        }
      },
      {
        $group: {
          _id: {
            year:  { $year:  '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const totalRevenue = Number(((revenueAgg[0] && revenueAgg[0].total) || 0).toFixed(2));

  // Build user growth array — ensure every month is present even if count is 0
  const growthMap = new Map(
    userGrowthDocs.map(doc => [
      `${doc._id.year}-${String(doc._id.month).padStart(2, '0')}`,
      doc.count
    ])
  );
  const userGrowth = months.map(m => ({
    month: m.key,
    count: growthMap.get(m.key) || 0
  }));

  // Resolve restaurant names
  const restaurantMap = new Map(allRestaurants.map(r => [r.restaurant_id, r.name]));
  const mostPopularRestaurants = restaurantOrderAgg.map(doc => ({
    restaurant_id: doc._id,
    name: restaurantMap.get(doc._id) || `Restaurant #${doc._id}`,
    order_count: doc.order_count
  }));

  return {
    total_orders: totalOrdersCount,
    total_revenue: totalRevenue,
    total_users: totalUsersCount,
    user_growth: userGrowth,
    most_popular_restaurants: mostPopularRestaurants
  };
}

export async function adminResetPassword(user_id, newPassword) {
  if (!newPassword || String(newPassword).length < 6) {
    const error = new Error('Password must be at least 6 characters');
    error.status = 400;
    throw error;
  }
  const hash = await bcrypt.hash(String(newPassword), 10);
  const updated = await User.findOneAndUpdate(
    { user_id: Number(user_id) },
    { password_hash: hash },
    { new: true }
  ).lean();
  if (!updated) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return serializeUser(updated);
}

// --- Audit Log ---

export async function createAuditLog({ actor_id, action, target_id = null, target_type = '', note = '' }) {
  try {
    await AuditLog.create({
      log_id: await getNextSequence('audit_logs'),
      actor_id: Number(actor_id),
      action: String(action).trim(),
      target_id: target_id != null ? Number(target_id) : null,
      target_type: String(target_type || ''),
      note: String(note || ''),
      created_at: new Date()
    });
  } catch (err) {
    // Audit log failure must never break the primary action — log and continue.
    console.error('[AuditLog] Failed to write audit entry:', err.message);
  }
}

export async function listAuditLogs({ page = 1, limit = 50 } = {}) {
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find().sort({ created_at: -1 }).skip(skip).limit(Number(limit)).lean(),
    AuditLog.countDocuments()
  ]);

  // Batch-resolve actor names
  const actorIds = [...new Set(logs.map(l => l.actor_id))];
  const actors = await User.find({ user_id: { $in: actorIds } }, { user_id: 1, first_name: 1, last_name: 1, email: 1 }).lean();
  const actorMap = new Map(actors.map(a => [a.user_id, a]));

  return {
    total,
    page: Number(page),
    limit: Number(limit),
    results: logs.map(l => serializeAuditLog(l, actorMap.get(l.actor_id) || null))
  };
}

// --- Global Promotions ---

export async function createGlobalPromo({ code, type, value, min_order, max_uses, expires_at, created_by }) {
  if (!code || !String(code).trim()) {
    const error = new Error('code is required');
    error.status = 400;
    throw error;
  }
  if (!['flat', 'percentage'].includes(type)) {
    const error = new Error('type must be "flat" or "percentage"');
    error.status = 400;
    throw error;
  }
  const numValue = Number(value);
  if (isNaN(numValue) || numValue < 0) {
    const error = new Error('value must be a non-negative number');
    error.status = 400;
    throw error;
  }
  if (type === 'percentage' && numValue > 100) {
    const error = new Error('percentage value cannot exceed 100');
    error.status = 400;
    throw error;
  }

  const normalizedCode = String(code).toUpperCase().trim();
  const existing = await GlobalPromotion.findOne({ code: normalizedCode }).lean();
  if (existing) {
    const error = new Error('A global promo with that code already exists');
    error.status = 400;
    throw error;
  }

  const promo = await GlobalPromotion.create({
    promo_id: await getNextSequence('global_promos'),
    code: normalizedCode,
    type,
    value: numValue,
    min_order: (min_order !== undefined && min_order !== null && min_order !== '') ? Number(min_order) : null,
    max_uses: (max_uses !== undefined && max_uses !== null && max_uses !== '') ? Number(max_uses) : null,
    uses: 0,
    expires_at: expires_at ? new Date(expires_at) : null,
    active: true,
    created_by: Number(created_by),
    created_at: new Date()
  });

  return serializeGlobalPromo(promo.toObject());
}

export async function validateGlobalPromo(code, subtotal) {
  const normalizedCode = String(code).toUpperCase().trim();
  const promo = await GlobalPromotion.findOne({ code: normalizedCode }).lean();

  if (!promo) {
    const error = new Error('Invalid promo code');
    error.status = 400;
    throw error;
  }

  if (!promo.active) {
    const error = new Error('This promo code is no longer active');
    error.status = 400;
    throw error;
  }

  const now = new Date();
  if (promo.expires_at && new Date(promo.expires_at) < now) {
    const error = new Error('This promo code has expired');
    error.status = 400;
    throw error;
  }

  if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
    const error = new Error('This promo code has reached its usage limit');
    error.status = 400;
    throw error;
  }

  const sub = Number(subtotal || 0);
  if (promo.min_order !== null && sub < promo.min_order) {
    const error = new Error(`Minimum order of Tk ${promo.min_order} required for this promo code`);
    error.status = 400;
    throw error;
  }

  let discountAmount = 0;
  if (promo.type === 'percentage') {
    discountAmount = Number(((sub * promo.value) / 100).toFixed(2));
  } else {
    discountAmount = Number(Math.min(promo.value, sub).toFixed(2));
  }

  return {
    scope: 'global',
    promo_id: promo.promo_id,
    code: promo.code,
    title: `Global Promo: ${promo.code}`,
    description: '',
    discount_type: promo.type,
    discount_value: promo.value,
    discount_amount: discountAmount
  };
}

export async function applyGlobalPromo(promo_id) {
  await GlobalPromotion.findOneAndUpdate(
    { promo_id: Number(promo_id) },
    { $inc: { uses: 1 } }
  );
}

export async function listGlobalPromos() {
  const promos = await GlobalPromotion.find().sort({ promo_id: -1 }).lean();
  return {
    count: promos.length,
    results: promos.map(serializeGlobalPromo)
  };
}

export async function toggleGlobalPromo(promo_id) {
  const promo = await GlobalPromotion.findOne({ promo_id: Number(promo_id) }).lean();
  if (!promo) {
    const error = new Error('Global promo not found');
    error.status = 404;
    throw error;
  }
  const updated = await GlobalPromotion.findOneAndUpdate(
    { promo_id: Number(promo_id) },
    { active: !promo.active },
    { new: true }
  ).lean();
  return serializeGlobalPromo(updated);
}

export async function deleteGlobalPromo(promo_id) {
  const deleted = await GlobalPromotion.findOneAndDelete({ promo_id: Number(promo_id) }).lean();
  if (!deleted) {
    const error = new Error('Global promo not found');
    error.status = 404;
    throw error;
  }
}

export async function seedAdminBootstrapData() {
  const adminEmail = 'admin@foodexpress.com';
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await User.create({
      user_id: await getNextSequence('users'),
      first_name: 'Super',
      last_name: 'Admin',
      email: adminEmail,
      phone: '+8801700000001',
      password_hash: adminPasswordHash,
      role: 'admin',
      restaurant_id: null,
      status: 'active'
    });
  }

  // Superadmin user
  const superadminEmail = 'superadmin@fdp.com';
  const superadminPasswordHash = await bcrypt.hash('superadmin123', 10);
  const existingSuperadmin = await User.findOne({ email: superadminEmail });
  if (!existingSuperadmin) {
    await User.create({
      user_id: await getNextSequence('users'),
      first_name: 'Platform',
      last_name: 'Superadmin',
      email: superadminEmail,
      phone: '+8801700000099',
      password_hash: superadminPasswordHash,
      role: 'superadmin',
      restaurant_id: null,
      status: 'active'
    });
    console.log('Created superadmin: superadmin@fdp.com / superadmin123');
  }

  // Restaurant-scoped admin accounts
  const restaurantAdmins = [
    {
      email: 'admin@pizzaburg.com',
      first_name: 'Pizzaburg',
      last_name: 'Admin',
      phone: '+8801700000010',
      restaurant_id: 1
    },
    {
      email: 'admin@peyaritehari.com',
      first_name: 'Peyari Tehari',
      last_name: 'Admin',
      phone: '+8801700000020',
      restaurant_id: 2
    }
  ];

  for (const ra of restaurantAdmins) {
    const existing = await User.findOne({ email: ra.email });
    if (!existing) {
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
      console.log(`Created restaurant admin: ${ra.email} → restaurant_id ${ra.restaurant_id}`);
    } else if (existing.restaurant_id !== ra.restaurant_id) {
      await User.updateOne({ email: ra.email }, { restaurant_id: ra.restaurant_id });
    }
  }

  const customerEmail = 'user@foodexpress.com';
  const customerPasswordHash = await bcrypt.hash('User123!', 10);

  const existingCustomer = await User.findOne({ email: customerEmail });
  if (!existingCustomer) {
    await User.create({
      user_id: await getNextSequence('users'),
      first_name: 'Demo',
      last_name: 'Customer',
      email: customerEmail,
      phone: '+8801700000002',
      password_hash: customerPasswordHash,
      role: 'customer',
      status: 'active'
    });
  }

  const deliveryPeople = [
    {
      delivery_person_id: 1,
      name: 'Rahim Hossain',
      phone: '+8801711111111',
      email: 'rahim@foodexpress.com',
      zone: 'Gulshan',
      status: 'available',
      completed_deliveries: 148,
      active_orders: 0,
      rating: 4.9
    },
    {
      delivery_person_id: 2,
      name: 'Karim Ahmed',
      phone: '+8801722222222',
      email: 'karim@foodexpress.com',
      zone: 'Banani',
      status: 'busy',
      completed_deliveries: 121,
      active_orders: 1,
      rating: 4.8
    },
    {
      delivery_person_id: 3,
      name: 'Nadia Sultana',
      phone: '+8801733333333',
      email: 'nadia@foodexpress.com',
      zone: 'Baridhara',
      status: 'available',
      completed_deliveries: 94,
      active_orders: 0,
      rating: 4.9
    }
  ];

  for (const person of deliveryPeople) {
    await DeliveryPerson.findOneAndUpdate(
      { delivery_person_id: person.delivery_person_id },
      person,
      { upsert: true, new: true }
    );
  }

  const promotions = [
    {
      promotion_id: 1,
      code: 'WELCOME20',
      title: 'Welcome Offer',
      description: '20% off on the first order.',
      discount_type: 'percentage',
      discount_value: 20,
      active: true,
      starts_at: new Date(),
      ends_at: null,
      usage_count: 0
    },
    {
      promotion_id: 2,
      code: 'PIZZABURG50',
      title: 'Flat Tk 50 Off',
      description: 'Tk 50 off for orders above Tk 699.',
      discount_type: 'flat',
      discount_value: 50,
      active: true,
      starts_at: new Date(),
      ends_at: null,
      usage_count: 0
    }
  ];

  for (const promotion of promotions) {
    await Promotion.findOneAndUpdate(
      { promotion_id: promotion.promotion_id },
      promotion,
      { upsert: true, new: true }
    );
  }
}

// --- Categories ---

function deriveCategorySlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createCategory({ name }) {
  if (!name || !String(name).trim()) {
    const error = new Error('name is required');
    error.status = 400;
    throw error;
  }
  const trimmedName = String(name).trim();
  const slug = deriveCategorySlug(trimmedName);

  const existing = await Category.findOne({ $or: [{ name: trimmedName }, { slug }] });
  if (existing) {
    const error = new Error('A category with that name already exists.');
    error.status = 409;
    throw error;
  }

  const created = await Category.create({
    category_id: await getNextSequence('categories'),
    name: trimmedName,
    slug,
    active: true,
    created_at: new Date()
  });

  return serializeCategory(created.toObject());
}

export async function listCategories() {
  const items = await Category.find().sort({ active: -1, name: 1 }).lean();
  return {
    count: items.length,
    results: items.map(serializeCategory)
  };
}

export async function listActiveCategories() {
  const items = await Category.find({ active: true }).sort({ name: 1 }).lean();
  return {
    count: items.length,
    results: items.map(serializeCategory)
  };
}

export async function updateCategory(categoryId, { name }) {
  if (!name || !String(name).trim()) {
    const error = new Error('name is required');
    error.status = 400;
    throw error;
  }
  const trimmedName = String(name).trim();
  const slug = deriveCategorySlug(trimmedName);

  // Check uniqueness excluding self
  const conflict = await Category.findOne({
    $or: [{ name: trimmedName }, { slug }],
    category_id: { $ne: Number(categoryId) }
  });
  if (conflict) {
    const error = new Error('A category with that name already exists.');
    error.status = 409;
    throw error;
  }

  const updated = await Category.findOneAndUpdate(
    { category_id: Number(categoryId) },
    { name: trimmedName, slug },
    { new: true }
  ).lean();

  if (!updated) {
    const error = new Error('Category not found');
    error.status = 404;
    throw error;
  }

  return serializeCategory(updated);
}

export async function toggleCategory(categoryId) {
  const cat = await Category.findOne({ category_id: Number(categoryId) });
  if (!cat) {
    const error = new Error('Category not found');
    error.status = 404;
    throw error;
  }

  cat.active = !cat.active;
  await cat.save();
  return serializeCategory(cat.toObject());
}

export async function deleteCategory(categoryId) {
  const id = Number(categoryId);

  // Block delete if any food references this category
  const inUse = await Food.countDocuments({ category_id: id });
  if (inUse > 0) {
    const error = new Error(`Cannot delete: ${inUse} food item(s) are using this category.`);
    error.status = 409;
    throw error;
  }

  const deleted = await Category.findOneAndDelete({ category_id: id }).lean();
  if (!deleted) {
    const error = new Error('Category not found');
    error.status = 404;
    throw error;
  }
}

export async function getCategoryFoodCount(categoryId) {
  return Food.countDocuments({ category_id: Number(categoryId) });
}

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
