const crypto = require('crypto');
const MFAChallenge = require('../models/MFAChallenge');
const { enqueueNotification } = require('./jobDispatchService');

function hashCode(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function makeOtp() {
  const value = Math.floor(100000 + Math.random() * 900000);
  return String(value);
}

async function createMfaChallenge({ userId, method, contact }) {
  const challengeId = crypto.randomUUID();
  const otp = makeOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await MFAChallenge.create({
    challengeId,
    userId,
    method,
    codeHash: hashCode(otp),
    expiresAt,
  });

  if (method === 'email_otp' && contact) {
    await enqueueNotification({
      channel: 'email',
      to: contact,
      template: 'mfa_otp',
      data: { otp, expiresInMin: 5 },
    });
  }

  return {
    challengeId,
    expiresAt,
    // For scaffold/dev visibility only. Do not expose in production.
    otpPreview: process.env.NODE_ENV === 'production' ? undefined : otp,
  };
}

async function verifyMfaChallenge({ challengeId, otp }) {
  const item = await MFAChallenge.findOne({ challengeId });
  if (!item) return { ok: false, code: 'AUTH_MFA_CHALLENGE_NOT_FOUND' };
  if (item.usedAt) return { ok: false, code: 'AUTH_MFA_CHALLENGE_USED' };
  if (item.expiresAt <= new Date()) return { ok: false, code: 'AUTH_MFA_CHALLENGE_EXPIRED' };
  if (hashCode(otp) !== item.codeHash) return { ok: false, code: 'AUTH_MFA_INVALID_OTP' };

  item.usedAt = new Date();
  await item.save();
  return { ok: true, userId: item.userId.toString(), method: item.method };
}

module.exports = { createMfaChallenge, verifyMfaChallenge };
