const mongoose = require('mongoose');

const userReputationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  sellerScore: { type: Number, min: 0, max: 5, default: 5 },
  completedSales: { type: Number, min: 0, default: 0 },
  disputesOpenedAgainst: { type: Number, min: 0, default: 0 },
  disputesLost: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('UserReputation', userReputationSchema);
