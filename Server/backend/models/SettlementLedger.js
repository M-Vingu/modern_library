const mongoose = require('mongoose');

const settlementLedgerSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
  bookingType: { type: String, enum: ['cab', 'accommodation'], required: true, index: true },
  bookingRefId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grossAmount: { type: Number, required: true, min: 0 },
  commissionPercent: { type: Number, required: true, min: 0, max: 100 },
  commissionAmount: { type: Number, required: true, min: 0 },
  partnerPayout: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ['KES', 'USD', 'EUR', 'GBP'], default: 'KES' },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'reversed', 'settled'],
    default: 'pending',
    index: true,
  },
  notes: { type: String, trim: true },
  settledAt: Date,
}, { timestamps: true });

settlementLedgerSchema.index({ bookingType: 1, bookingRefId: 1 }, { unique: true });

module.exports = mongoose.model('SettlementLedger', settlementLedgerSchema);
