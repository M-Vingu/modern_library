const mongoose = require('mongoose');

const parentControlSchema = new mongoose.Schema({
  parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kidId: { type: mongoose.Schema.Types.ObjectId, ref: 'KidProfile', required: true, index: true },
  dailyScreenLimitMin: { type: Number, min: 5, max: 360, default: 90 },
  allowedTopics: [{ type: String, trim: true }],
  blockedTopics: [{ type: String, trim: true }],
  interactionMode: { type: String, enum: ['solo_only', 'approved_only'], default: 'solo_only' },
  purchasePinEnabled: { type: Boolean, default: false },
}, { timestamps: true });

parentControlSchema.index({ parentUserId: 1, kidId: 1 }, { unique: true });

module.exports = mongoose.model('ParentControl', parentControlSchema);
