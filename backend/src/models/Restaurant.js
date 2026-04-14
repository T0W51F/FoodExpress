import mongoose from 'mongoose';

const restaurantSchema = new mongoose.Schema(
  {
    restaurant_id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    cuisine: { type: String, required: true },
    delivery_time: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    delivery_fee: { type: Number, default: 0 },
    min_order: { type: Number, default: 0 },
    image: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    is_open: { type: Boolean, default: true },
    categories: { type: [String], default: [] },
    operating_hours: { type: String, default: '10:00 AM - 11:00 PM' },
    contact_phone: { type: String, default: '' },
    contact_email: { type: String, default: '' },
    service_area: { type: String, default: 'Gulshan, Dhaka' },
    restricted: { type: Boolean, default: false },
    description: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Restaurant = mongoose.model('Restaurant', restaurantSchema);
