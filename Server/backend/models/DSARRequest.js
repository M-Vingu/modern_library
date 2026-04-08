const mongoose = require('mongoose');

const dsarRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requestType: { type: String, enum: ['export', 'delete'], required: true, index: true },
  status: { type: String, enum: ['requested', 'in_progress', 'completed', 'rejected'], default: 'requested', index: true },
  reason: { type: String, trim: true },
  resolutionNotes: { type: String, trim: true },
  requestedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date },
}, { timestamps: true });

dsarRequestSchema.index({ userId: 1, requestType: 1, createdAt: -1 });

module.exports = mongoose.model('DSARRequest', dsarRequestSchema);
