import mongoose from 'mongoose';

const partnerApplicationSchema = new mongoose.Schema(
  {
    application_id: { type: Number, required: true, unique: true, index: true },
    business_name: { type: String, required: true, trim: true },
    contact_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejection_reason: { type: String, default: '' },
    user_id: { type: Number, default: null },
    restaurant_id: { type: Number, default: null }
  },
  { timestamps: true }
);

export const PartnerApplication = mongoose.model('PartnerApplication', partnerApplicationSchema);
