const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({

  name: { type: String, required: true },
price: {
  amount: { type: Number, required: true },
  currency: { 
    type: String,
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    default: 'KES'
  }
},

  seller: String,

  stock: { type: Number, default: 0 },

  category: String

}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);