const mongoose = require('mongoose');

const consentRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  policyType: { type: String, enum: ['terms', 'privacy', 'parental-consent'], required: true, index: true },
  policyVersion: { type: String, required: true, index: true },
  acceptedAt: { type: Date, default: Date.now, immutable: true },
  metadata: { type: Object },
}, { timestamps: true });

consentRecordSchema.index({ userId: 1, policyType: 1, policyVersion: 1 }, { unique: true });

module.exports = mongoose.model('ConsentRecord', consentRecordSchema);
