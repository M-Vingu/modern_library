const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true, index: true },
  targetId: { type: String, index: true },
  status: { type: String, enum: ['success', 'failed'], default: 'success', index: true },
  errorCode: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  requestId: { type: String, index: true },
  metadata: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
