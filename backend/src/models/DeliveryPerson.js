import mongoose from 'mongoose';

const deliveryPersonSchema = new mongoose.Schema(
  {
    delivery_person_id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    zone: { type: String, default: 'Dhaka North' },
    status: { type: String, enum: ['available', 'busy', 'offline'], default: 'available' },
    completed_deliveries: { type: Number, default: 0 },
    active_orders: { type: Number, default: 0 },
    rating: { type: Number, default: 4.8 }
  },
  { timestamps: true }
);

export const DeliveryPerson = mongoose.model('DeliveryPerson', deliveryPersonSchema);
