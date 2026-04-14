export function serializeUser(user) {
  return {
    id: user.user_id,
    user_id: user.user_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone || '',
    role: user.role || 'customer',
    restaurant_id: user.restaurant_id || null,
    status: user.status || 'active',
    banned: Boolean(user.banned),
    ban_reason: user.ban_reason || '',
    created_at: user.createdAt
  };
}

export function serializePartnerApplication(app) {
  return {
    id: app.application_id,
    application_id: app.application_id,
    business_name: app.business_name,
    contact_name: app.contact_name,
    email: app.email,
    phone: app.phone,
    address: app.address,
    description: app.description || '',
    status: app.status,
    rejection_reason: app.rejection_reason || '',
    user_id: app.user_id || null,
    restaurant_id: app.restaurant_id || null,
    created_at: app.createdAt,
    updated_at: app.updatedAt
  };
}

export function parseDeliveryWindow(deliveryTime = '') {
  const match = String(deliveryTime).match(/(\d+)\s*-\s*(\d+)/);
  return {
    min: match ? Number(match[1]) : null,
    max: match ? Number(match[2]) : null
  };
}

export function serializeRestaurant(restaurant) {
  const deliveryWindow = parseDeliveryWindow(restaurant.delivery_time);
  return {
    id: restaurant.restaurant_id ?? restaurant.id,
    restaurant_id: restaurant.restaurant_id ?? restaurant.id,
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    cuisine_type: restaurant.cuisine,
    delivery_time: restaurant.delivery_time,
    delivery_time_min: deliveryWindow.min,
    delivery_time_max: deliveryWindow.max,
    rating: restaurant.rating,
    reviews: restaurant.reviews,
    delivery_fee: restaurant.delivery_fee,
    minimum_order: restaurant.min_order,
    min_order: restaurant.min_order,
    image: restaurant.image,
    logo: restaurant.image ? `/assets/images/foods/${restaurant.image}` : null,
    is_featured: Boolean(restaurant.featured),
    featured: Boolean(restaurant.featured),
    is_open: Boolean(restaurant.is_open),
    categories: restaurant.categories || [],
    operating_hours: restaurant.operating_hours || '',
    contact_phone: restaurant.contact_phone || '',
    contact_email: restaurant.contact_email || '',
    service_area: restaurant.service_area || '',
    restricted: Boolean(restaurant.restricted),
    description: restaurant.description || ''
  };
}

export function serializeFood(food) {
  return {
    ...food,
    id: food.food_id ?? food.id,
    food_id: food.food_id ?? food.id,
    image_url: food.image ? `/assets/images/foods/${food.image}` : null
  };
}

export function serializeAuditLog(log, actor = null) {
  return {
    id: log.log_id,
    log_id: log.log_id,
    actor_id: log.actor_id,
    actor_name: actor ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || actor.email : `Admin #${log.actor_id}`,
    actor_email: actor ? actor.email : '',
    action: log.action,
    target_id: log.target_id ?? null,
    target_type: log.target_type || '',
    note: log.note || '',
    created_at: log.created_at
  };
}

export function serializeCategory(cat) {
  return {
    id: cat.category_id,
    category_id: cat.category_id,
    name: cat.name,
    slug: cat.slug,
    active: Boolean(cat.active),
    created_at: cat.created_at
  };
}

export function serializeGlobalPromo(promo) {
  return {
    id: promo.promo_id,
    promo_id: promo.promo_id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    min_order: promo.min_order ?? null,
    max_uses: promo.max_uses ?? null,
    uses: promo.uses ?? 0,
    expires_at: promo.expires_at ?? null,
    active: Boolean(promo.active),
    created_by: promo.created_by,
    created_at: promo.created_at
  };
}
