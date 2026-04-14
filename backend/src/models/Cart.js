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

const cartItemSchema = new mongoose.Schema(
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

const cartSchema = new mongoose.Schema(
  {
    user_id: { type: Number, required: true, unique: true, index: true },
    items: { type: [cartItemSchema], default: [] }
  },
  { timestamps: true }
);

export const Cart = mongoose.model('Cart', cartSchema);
