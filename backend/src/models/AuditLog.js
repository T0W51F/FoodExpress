import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    log_id:      { type: Number, required: true, unique: true, index: true },
    actor_id:    { type: Number, required: true, index: true },
    action:      { type: String, required: true, trim: true },
    target_id:   { type: Number, default: null },
    target_type: { type: String, default: '' },
    note:        { type: String, default: '' },
    created_at:  { type: Date, default: Date.now }
  },
  { timestamps: false }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
