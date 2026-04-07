const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  route: { type: String, required: true, index: true },
  method: { type: String, required: true },
  statusCode: { type: Number, required: true },
  responseBody: { type: Object, required: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);
