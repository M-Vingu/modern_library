const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, min: 0, required: true },
  currency: { type: String, enum: ['KES', 'USD', 'EUR', 'GBP'], default: 'KES' },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
  features: [{ type: String }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
