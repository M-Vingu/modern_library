const test = require('node:test');
const assert = require('node:assert/strict');

const { validateEnv } = require('../config/validateEnv');

function withEnv(temp, fn) {
  const backup = {};
  const keys = Object.keys(temp);
  for (const key of keys) {
    backup[key] = process.env[key];
    process.env[key] = temp[key];
  }

  try {
    fn();
  } finally {
    for (const key of keys) {
      if (backup[key] === undefined) delete process.env[key];
      else process.env[key] = backup[key];
    }
  }
}

test('validateEnv requires SMTP host when MFA enforced with smtp email provider', () => {
  withEnv({
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    MFA_ENFORCED: 'true',
    MFA_ISSUER: 'modern-library',
    MFA_DEFAULT_METHOD: 'email_otp',
    NOTIFICATION_EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: '',
    SMTP_FROM: '',
  }, () => {
    assert.throws(() => validateEnv(), /SMTP_HOST/);
  });
});
