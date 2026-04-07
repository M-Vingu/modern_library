const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  name: { 
    type: String, 
    required: true 
  },

  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },

  password: { 
    type: String,
    select: false
  },

  role: { 
    type: String, 
    enum: ['user', 'admin'],
    default: 'user' 
  },

  borrowedBooks: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Book' }
  ],

  enrolledCourses: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
  ],

  wallet: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Wallet' 
  },

  currency: { 
    type: String,
    enum: ['KES', 'USD', 'EUR', 'GBP'], 
    default: 'KES' 
  },

  locale: { 
    type: String, 
    default: 'en-US' 
  },

  googleId: String,

  referralCode: String,

  lastLogin: Date
,
  mfaEnabled: {
    type: Boolean,
    default: false,
  },
  mfaMethod: {
    type: String,
    enum: ['none', 'totp', 'email_otp', 'sms_otp'],
    default: 'none',
  },
  mfaSecretRef: {
    type: String,
  },
  mfaBackupCodes: [{
    type: String,
    select: false,
  }]

}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
