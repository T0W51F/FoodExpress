import mongoose from 'mongoose';

const globalPromotionSchema = new mongoose.Schema(
  {
    promo_id: { type: Number, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['flat', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
    min_order: { type: Number, default: null },
    max_uses: { type: Number, default: null },
    uses: { type: Number, default: 0 },
    expires_at: { type: Date, default: null },
    active: { type: Boolean, default: true },
    created_by: { type: Number, required: true },
    created_at: { type: Date, default: Date.now }
  }
);

export const GlobalPromotion = mongoose.model('GlobalPromotion', globalPromotionSchema);
