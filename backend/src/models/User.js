import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    user_id: { type: Number, required: true, unique: true, index: true },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin', 'restaurant_admin', 'superadmin'], default: 'customer' },
    restaurant_id: { type: Number, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    banned: { type: Boolean, default: false },
    ban_reason: { type: String, default: '' }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
