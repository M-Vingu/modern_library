const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({

  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true // 🔥 one wallet per user
  },

  balance: { 
    type: Number, 
    default: 0,
    min: 0
  },

  currency: { 
    type: String, 
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    default: 'KES' 
  },

transactions: [
  {
    type: { 
      type: String, 
      enum: ['reward', 'payment', 'deposit', 'withdraw', 'cashback'],
      required: true
    },
    amount: { type: Number, required: true },

    currency: {
      type: String,
      enum: ['KES', 'USD', 'EUR', 'GBP'],
      default: 'KES'
    },

    description: String,

    date: { type: Date, default: Date.now }
  }
]

}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);