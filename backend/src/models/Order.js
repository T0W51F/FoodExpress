import mongoose from 'mongoose';

const addonSchema = new mongoose.Schema(
  {
    name: String,
    price: Number
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    cuisine: String,
    image: String,
    rating: Number,
    delivery_time: String
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    id: Number,
    restaurant_id: Number,
    name: String,
    description: String,
    price: Number,
    image: String,
    category: String,
    vegetarian: Boolean,
    spicy_level: Number,
    rating: Number,
    quantity: Number,
    instructions: String,
    totalPrice: Number,
    addons: { type: [addonSchema], default: [] },
    restaurant: restaurantSchema
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    order_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    status: { type: String, default: 'pending' },
    items: { type: [orderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    address: { type: String, default: '' },
    paymentMethod: { type: String, default: 'cash' },
    paymentGateway: { type: String, default: 'Cash on Delivery' },
    paymentStatus: { type: String, default: 'pending' },
    refundAmount: { type: Number, default: 0 },
    transactionReference: { type: String, default: '' },
    cancellation_reason: { type: String, default: '' },
    assigned_delivery_person_id: { type: Number, default: null },
    assigned_delivery_person_name: { type: String, default: '' },
    assigned_at: { type: Date, default: null },
    delivered_at: { type: Date, default: null },
    restaurant: { type: Object, default: null }
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);
