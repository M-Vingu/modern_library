const Wallet = require('../models/wallet');
const mongoose = require('mongoose');
const { writeAuditLog } = require('../services/auditLogService');

async function createWallet(userId) {
  const existing = await Wallet.findOne({ userId });
  if (existing) return existing;

  const wallet = new Wallet({ userId, balance: 0, transactions: [] });
  await wallet.save();
  return wallet;
}

async function addFunds(req, res) {
  try {
    const { amount, type, description } = req.body;
    const userId = req.user._id;
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: parsedAmount },
        $push: {
          transactions: {
            type: type || 'deposit',
            amount: parsedAmount,
            description: description || 'Funds added',
          },
        },
      },
      { returnDocument: 'after' },
    );

    if (!updatedWallet) return res.status(404).json({ message: 'Wallet not found' });
    res.json({ message: 'Funds added successfully', wallet: updatedWallet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deductFunds(req, res) {
  const session = await mongoose.startSession();
  try {
    const { amount, description } = req.body;
    const userId = req.user._id;
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    let finalWallet;
    await session.withTransaction(async () => {
      const paymentWallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: parsedAmount } },
        {
          $inc: { balance: -parsedAmount },
          $push: {
            transactions: {
              type: 'payment',
              amount: parsedAmount,
              description: description || 'Payment',
            },
          },
        },
        { returnDocument: 'after', session },
      );

      if (!paymentWallet) {
        const walletExists = await Wallet.exists({ userId }).session(session);
        const error = new Error(walletExists ? 'Insufficient balance' : 'Wallet not found');
        error.status = walletExists ? 400 : 404;
        throw error;
      }

      const cashback = Number((parsedAmount * 0.05).toFixed(2));
      finalWallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { balance: cashback },
          $push: {
            transactions: {
              type: 'cashback',
              amount: cashback,
              description: 'Cashback reward',
            },
          },
        },
        { returnDocument: 'after', session },
      );
    });

    await writeAuditLog(req, {
      action: 'wallet.payment',
      targetType: 'wallet',
      targetId: req.user._id,
      metadata: { amount: parsedAmount },
    });

    res.json({
      message: 'Payment successful',
      balance: finalWallet.balance,
      wallet: finalWallet,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    session.endSession();
  }
}

async function getWallet(req, res) {
  try {
    const userId = req.user._id;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    res.json(wallet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createWallet,
  addFunds,
  deductFunds,
  getWallet,
};
