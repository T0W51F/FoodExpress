import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    promotion_id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    discount_type: { type: String, enum: ['percentage', 'flat'], default: 'percentage' },
    discount_value: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    starts_at: { type: Date, default: Date.now },
    ends_at: { type: Date, default: null },
    usage_count: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Promotion = mongoose.model('Promotion', promotionSchema);
