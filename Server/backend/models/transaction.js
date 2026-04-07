const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: { type: String, required: true }, // deposit, borrow, pay, etc.
  amount: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' }, // optional now
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);