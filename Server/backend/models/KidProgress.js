const mongoose = require('mongoose');

const kidProgressSchema = new mongoose.Schema({
  kidId: { type: mongoose.Schema.Types.ObjectId, ref: 'KidProfile', required: true, index: true },
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'KidContent', required: true, index: true },
  completionPct: { type: Number, min: 0, max: 100, default: 0 },
  score: { type: Number, min: 0, max: 100, default: 0 },
  timeSpentSec: { type: Number, min: 0, default: 0 },
  attempts: { type: Number, min: 0, default: 1 },
  lastSeenAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

kidProgressSchema.index({ kidId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model('KidProgress', kidProgressSchema);
