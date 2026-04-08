const mongoose = require('mongoose');

const kidContentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['video', 'game', 'story', 'interactive'], required: true, index: true },
  ageBandMin: { type: Number, min: 3, max: 17, required: true, index: true },
  ageBandMax: { type: Number, min: 3, max: 17, required: true, index: true },
  topics: [{ type: String, trim: true, index: true }],
  learningObjectives: [{ type: String, trim: true }],
  mediaUrl: { type: String, trim: true },
  safetyRating: { type: String, enum: ['green', 'amber', 'red'], default: 'green', index: true },
  provider: { type: String, default: 'internal' },
  isPublished: { type: Boolean, default: true, index: true },
}, { timestamps: true });

kidContentSchema.index({ isPublished: 1, ageBandMin: 1, ageBandMax: 1, safetyRating: 1, createdAt: -1 });

module.exports = mongoose.model('KidContent', kidContentSchema);
