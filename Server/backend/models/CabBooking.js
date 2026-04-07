const mongoose = require('mongoose');

const cabBookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CabVehicle', required: true, index: true },
  pickupLocation: { type: String, required: true, trim: true },
  dropoffLocation: { type: String, required: true, trim: true },
  scheduledAt: { type: Date },
  distanceKm: { type: Number, min: 0 },
  estimatedFare: { type: Number, min: 0, required: true },
  finalFare: { type: Number, min: 0 },
  currency: { type: String, enum: ['KES', 'USD', 'EUR', 'GBP'], default: 'KES' },
  status: {
    type: String,
    enum: ['requested', 'accepted', 'ongoing', 'completed', 'cancelled', 'rejected'],
    default: 'requested',
    index: true,
  },
  notes: { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('CabBooking', cabBookingSchema);
