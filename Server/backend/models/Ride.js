const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({

  from: { type: String, required: true },
  to: { type: String, required: true },

  driver: String,

  seats: { type: Number, default: 0 },

price: {
  amount: { type: Number, required: true },
  currency: { 
    type: String,
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    default: 'KES'
  }
},

  passengers: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);