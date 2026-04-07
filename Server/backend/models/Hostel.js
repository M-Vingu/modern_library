const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({

  name: { type: String, required: true },

  rooms: { type: Number, default: 1 },

  price: { type: Number, required: true },

  occupants: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Hostel', hostelSchema);