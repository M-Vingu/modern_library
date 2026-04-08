const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  status: { type: String, enum: ['active', 'past_due', 'cancelled'], default: 'active', index: true },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, required: true, index: true },
  externalRef: { type: String },
}, { timestamps: true });

userSubscriptionSchema.index({ userId: 1, status: 1, endsAt: -1 });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
