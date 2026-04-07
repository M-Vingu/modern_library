const mongoose = require('mongoose');

const marketplaceListingSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: {
    type: String,
    enum: ['book', 'notes', 'stationery', 'electronics', 'furniture', 'other'],
    default: 'other',
  },
  condition: {
    type: String,
    enum: ['new', 'like_new', 'good', 'fair', 'poor'],
    default: 'good',
  },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['KES', 'USD', 'EUR', 'GBP'], default: 'KES' },
  imageUrls: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ['active', 'reserved', 'sold', 'inactive'],
    default: 'active',
    index: true,
  },
  quantity: { type: Number, min: 1, default: 1 },
  tags: [{ type: String, trim: true }],
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  soldAt: Date,
}, { timestamps: true });

marketplaceListingSchema.index({
  title: 'text',
  description: 'text',
  category: 'text',
  tags: 'text',
});
marketplaceListingSchema.index({ status: 1, createdAt: -1 });
marketplaceListingSchema.index({ sellerId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('MarketplaceListing', marketplaceListingSchema);
