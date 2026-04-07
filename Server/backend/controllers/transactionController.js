// controllers/transactionController.js
const Transaction = require('../models/transaction');
const Wallet = require('../models/wallet');
const mongoose = require('mongoose');

// GET all transactions for the logged-in user
async function getUserTransactions(req, res) {
  try {
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    const transactions = await Transaction.find({ walletId: wallet._id }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET single transaction by ID (user must own it)
async function getTransactionById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid transaction id' });
    }
    const wallet = await Wallet.findOne({ userId: req.user._id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    const transaction = await Transaction.findOne({ _id: req.params.id, walletId: wallet._id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// For admin only: get all transactions in the system
async function getAllTransactions(req, res) {
  try {
    // Optionally check for admin role: req.user.isAdmin
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getUserTransactions, getTransactionById, getAllTransactions };
