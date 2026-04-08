const mongoose = require('mongoose');

const mfaChallengeSchema = new mongoose.Schema({
  challengeId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, enum: ['totp', 'email_otp'], required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date },
}, { timestamps: true });

mfaChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MFAChallenge', mfaChallengeSchema);
