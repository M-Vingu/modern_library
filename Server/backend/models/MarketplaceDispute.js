const mongoose = require('mongoose');

const marketplaceDisputeSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'MarketplaceListing', required: true, index: true },
  openedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  againstUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'responded', 'resolved', 'rejected'], default: 'open', index: true },
  response: { type: String },
  resolution: { type: String },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

marketplaceDisputeSchema.index({ listingId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('MarketplaceDispute', marketplaceDisputeSchema);
