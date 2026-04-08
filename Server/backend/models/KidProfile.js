const mongoose = require('mongoose');

const kidProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  displayName: { type: String, required: true, trim: true },
  birthYear: { type: Number, min: 2000, max: 2100, required: true },
  ageBand: { type: String, enum: ['3-5', '6-8', '9-12', '13-17'], required: true, index: true },
  language: { type: String, default: 'en' },
  avatarUrl: { type: String, trim: true },
  status: { type: String, enum: ['active', 'paused'], default: 'active', index: true },
}, { timestamps: true });

kidProfileSchema.index({ parentUserId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('KidProfile', kidProfileSchema);
