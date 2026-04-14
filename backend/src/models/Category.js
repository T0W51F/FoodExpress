import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    category_id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
  }
);

export const Category = mongoose.model('Category', categorySchema);
