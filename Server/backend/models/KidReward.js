const mongoose = require('mongoose');

const kidRewardSchema = new mongoose.Schema({
  kidId: { type: mongoose.Schema.Types.ObjectId, ref: 'KidProfile', required: true, unique: true, index: true },
  points: { type: Number, min: 0, default: 0 },
  badges: [{ type: String, trim: true }],
  streakDays: { type: Number, min: 0, default: 0 },
  unlockables: [{ type: String, trim: true }],
}, { timestamps: true });

module.exports = mongoose.model('KidReward', kidRewardSchema);
