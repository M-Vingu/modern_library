const mongoose = require('mongoose');

const cabVehicleSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  plateNumber: { type: String, required: true, trim: true, uppercase: true, unique: true },
  vehicleType: { type: String, enum: ['sedan', 'van', 'bus', 'motorbike', 'other'], default: 'sedan' },
  seats: { type: Number, min: 1, default: 4 },
  driverName: { type: String, trim: true },
  driverPhone: { type: String, trim: true },
  baseFare: { type: Number, min: 0, default: 0 },
  farePerKm: { type: Number, min: 0, default: 0 },
  currency: { type: String, enum: ['KES', 'USD', 'EUR', 'GBP'], default: 'KES' },
  status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active', index: true },
}, { timestamps: true });

module.exports = mongoose.model('CabVehicle', cabVehicleSchema);
