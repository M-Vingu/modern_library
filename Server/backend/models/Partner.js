const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessType: { type: String, enum: ['cab', 'hotel', 'hostel', 'mixed'], required: true },
  businessName: { type: String, required: true, trim: true },
  registrationNumber: { type: String, trim: true },
  contactEmail: { type: String, required: true, trim: true, lowercase: true },
  contactPhone: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  address: { type: String, trim: true },
  description: { type: String, trim: true },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
    index: true,
  },
  verificationNotes: { type: String, trim: true },
}, { timestamps: true });

partnerSchema.index({ ownerUserId: 1, verificationStatus: 1, createdAt: -1 });
partnerSchema.index({ businessType: 1, verificationStatus: 1 });

module.exports = mongoose.model('Partner', partnerSchema);
