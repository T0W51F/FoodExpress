import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    review_id: { type: Number, required: true, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    restaurant_id: { type: Number },
    food_id: { type: Number },
    rating: { type: Number, default: 0 },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Review = mongoose.model('Review', reviewSchema);
