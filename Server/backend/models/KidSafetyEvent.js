const mongoose = require('mongoose');

const kidSafetyEventSchema = new mongoose.Schema({
  kidId: { type: mongoose.Schema.Types.ObjectId, ref: 'KidProfile', required: true, index: true },
  eventType: { type: String, required: true, index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low', index: true },
  source: { type: String, enum: ['ai_filter', 'user_report', 'moderation'], required: true },
  actionTaken: { type: String, trim: true },
  reviewStatus: { type: String, enum: ['open', 'triaged', 'resolved'], default: 'open', index: true },
  metadata: { type: Object },
}, { timestamps: true });

kidSafetyEventSchema.index({ kidId: 1, createdAt: -1 });

module.exports = mongoose.model('KidSafetyEvent', kidSafetyEventSchema);
