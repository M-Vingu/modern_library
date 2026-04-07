const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({

  title: { type: String, required: true },
  description: String,

  instructor: String,

price: {
  amount: { type: Number, required: true },
  currency: { 
    type: String,
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    default: 'KES'
  }
},

  students: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);