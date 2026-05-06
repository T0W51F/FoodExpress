import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    review_id: { type: Number, required: true, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    order_id: { type: String, index: true },
    restaurant_id: { type: Number },
    food_id: { type: Number },
    rating: { type: Number, default: 0 },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

reviewSchema.index({ user_id: 1, order_id: 1 });
reviewSchema.index({ user_id: 1, order_id: 1, food_id: 1 });

export const Review = mongoose.model('Review', reviewSchema);
