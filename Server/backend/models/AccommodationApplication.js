const mongoose = require('mongoose');

const accommodationApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'AccommodationListing', required: true, index: true },
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  occupants: { type: Number, min: 1, default: 1 },
  notes: { type: String, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  },
  reviewNotes: { type: String, trim: true },
}, { timestamps: true });

accommodationApplicationSchema.index({ userId: 1, createdAt: -1 });
accommodationApplicationSchema.index({ partnerId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('AccommodationApplication', accommodationApplicationSchema);
