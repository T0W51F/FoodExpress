import mongoose from 'mongoose';

const addonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true }
  },
  { _id: false }
);

const foodSchema = new mongoose.Schema(
  {
    food_id: { type: Number, required: true, unique: true, index: true },
    restaurant_id: { type: Number, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    image: { type: String, default: '' },
    category: { type: String, default: '' },
    category_id: { type: Number, default: null },
    vegetarian: { type: Boolean, default: false },
    spicy_level: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    popular: { type: Boolean, default: false },
    addons: { type: [addonSchema], default: [] }
  },
  { timestamps: true }
);

export const Food = mongoose.model('Food', foodSchema);
