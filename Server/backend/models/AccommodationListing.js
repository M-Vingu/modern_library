const mongoose = require('mongoose');

const accommodationListingSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  listingType: { type: String, enum: ['hotel', 'hostel'], required: true },
  name: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  roomType: { type: String, trim: true },
  capacity: { type: Number, min: 1, default: 1 },
  availableUnits: { type: Number, min: 0, default: 1 },
  pricePerNight: { type: Number, min: 0, required: true },
  currency: { type: String, enum: ['KES', 'USD', 'EUR', 'GBP'], default: 'KES' },
  amenities: [{ type: String, trim: true }],
  imageUrls: [{ type: String, trim: true }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
}, { timestamps: true });

module.exports = mongoose.model('AccommodationListing', accommodationListingSchema);
