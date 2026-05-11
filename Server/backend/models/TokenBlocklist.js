const mongoose = require('mongoose');

const tokenBlocklistSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true },
  reason: { type: String, default: 'revoked' },
}, { timestamps: true });

tokenBlocklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TokenBlocklist', tokenBlocklistSchema);
