const mongoose = require('mongoose');

const retentionPolicySchema = new mongoose.Schema({
  collection: { type: String, required: true, unique: true, index: true },
  retentionDays: { type: Number, min: 1, required: true },
  mode: { type: String, enum: ['soft_delete', 'hard_delete', 'archive'], default: 'soft_delete' },
  active: { type: Boolean, default: true },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('RetentionPolicy', retentionPolicySchema);
