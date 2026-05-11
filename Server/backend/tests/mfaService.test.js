const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const MFAChallenge = require('../models/MFAChallenge');
const jobDispatchService = require('../services/jobDispatchService');

function hashCode(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function loadMfaService() {
  const modulePath = require.resolve('../services/mfaService');
  delete require.cache[modulePath];
  return require('../services/mfaService');
}

async function withEnv(temp, fn) {
  const backup = {};
  const keys = Object.keys(temp);

  for (const key of keys) {
    backup[key] = process.env[key];
    process.env[key] = temp[key];
  }

  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (backup[key] === undefined) delete process.env[key];
      else process.env[key] = backup[key];
    }
  }
}

test('mfa service creates an email OTP challenge and enqueues notification delivery', async () => {
  const originalCreate = MFAChallenge.create;
  const originalEnqueueNotification = jobDispatchService.enqueueNotification;
  const created = [];
  const notifications = [];

  MFAChallenge.create = async (payload) => {
    created.push(payload);
    return payload;
  };
  jobDispatchService.enqueueNotification = async (payload) => {
    notifications.push(payload);
    return { queued: true, jobId: 'job-1' };
  };

  const { createMfaChallenge } = loadMfaService();

  await withEnv({
    MFA_ENFORCED: 'true',
    NODE_ENV: 'test',
  }, async () => {
    const result = await createMfaChallenge({
      userId: '507f1f77bcf86cd799439011',
      method: 'email_otp',
      contact: 'user@example.com',
    });

    assert.equal(created.length, 1);
    assert.equal(created[0].method, 'email_otp');
    assert.equal(typeof created[0].challengeId, 'string');
    assert.equal(typeof created[0].codeHash, 'string');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].channel, 'email');
    assert.equal(notifications[0].to, 'user@example.com');
    assert.equal(notifications[0].template, 'mfa_otp');
    assert.equal(notifications[0].requireDelivery, true);
    assert.equal(typeof result.challengeId, 'string');
    assert.equal(typeof result.otpPreview, 'string');
  });

  MFAChallenge.create = originalCreate;
  jobDispatchService.enqueueNotification = originalEnqueueNotification;
  loadMfaService();
});

test('mfa service hides OTP preview in production mode', async () => {
  const originalCreate = MFAChallenge.create;
  const originalEnqueueNotification = jobDispatchService.enqueueNotification;

  MFAChallenge.create = async (payload) => payload;
  jobDispatchService.enqueueNotification = async () => ({ queued: true, jobId: 'job-2' });

  const { createMfaChallenge } = loadMfaService();

  await withEnv({
    MFA_ENFORCED: 'false',
    NODE_ENV: 'production',
  }, async () => {
    const result = await createMfaChallenge({
      userId: '507f1f77bcf86cd799439011',
      method: 'email_otp',
      contact: 'user@example.com',
    });

    assert.equal(result.otpPreview, undefined);
  });

  MFAChallenge.create = originalCreate;
  jobDispatchService.enqueueNotification = originalEnqueueNotification;
  loadMfaService();
});

test('mfa service verifies a valid challenge and marks it used', async () => {
  const originalFindOne = MFAChallenge.findOne;
  let saveCalled = false;

  MFAChallenge.findOne = async () => ({
    userId: { toString: () => '507f1f77bcf86cd799439011' },
    method: 'email_otp',
    codeHash: hashCode('123456'),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    async save() {
      saveCalled = true;
    },
  });

  const { verifyMfaChallenge } = loadMfaService();
  const result = await verifyMfaChallenge({ challengeId: 'challenge-1', otp: '123456' });

  MFAChallenge.findOne = originalFindOne;

  assert.equal(result.ok, true);
  assert.equal(result.userId, '507f1f77bcf86cd799439011');
  assert.equal(result.method, 'email_otp');
  assert.equal(saveCalled, true);
});

test('mfa service rejects invalid OTP values', async () => {
  const originalFindOne = MFAChallenge.findOne;

  MFAChallenge.findOne = async () => ({
    userId: { toString: () => '507f1f77bcf86cd799439011' },
    method: 'email_otp',
    codeHash: hashCode('123456'),
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    async save() {
      throw new Error('should not save when OTP is invalid');
    },
  });

  const { verifyMfaChallenge } = loadMfaService();
  const result = await verifyMfaChallenge({ challengeId: 'challenge-2', otp: '999999' });

  MFAChallenge.findOne = originalFindOne;

  assert.equal(result.ok, false);
  assert.equal(result.code, 'AUTH_MFA_INVALID_OTP');
});
