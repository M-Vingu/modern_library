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

test('validateEnv rejects mock AI provider in production', () => {
  withEnv({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    AI_PROVIDER: 'mock',
    FRONTEND_URLS: 'https://app.example.com',
  }, () => {
    assert.throws(() => validateEnv(), /AI_PROVIDER/);
  });
});

test('validateEnv rejects log email provider for enforced MFA in production', () => {
  withEnv({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-openai-key',
    FRONTEND_URLS: 'https://app.example.com',
    MFA_ENFORCED: 'true',
    MFA_ISSUER: 'modern-library',
    MFA_DEFAULT_METHOD: 'email_otp',
    NOTIFICATION_EMAIL_PROVIDER: 'log',
  }, () => {
    assert.throws(() => validateEnv(), /NOTIFICATION_EMAIL_PROVIDER/);
  });
});

test('validateEnv requires OPENAI_API_KEY when AI provider is openai', () => {
  withEnv({
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: '',
  }, () => {
    assert.throws(() => validateEnv(), /OPENAI_API_KEY/);
  });
});

test('validateEnv rejects malformed AI prompt endpoint config JSON', () => {
  withEnv({
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-openai-key',
    AI_PROMPT_VERSION_BY_ENDPOINT_JSON: '{bad-json}',
  }, () => {
    assert.throws(() => validateEnv(), /AI_PROMPT_VERSION_BY_ENDPOINT_JSON/);
  });
});

test('validateEnv requires production frontend origins to use https', () => {
  withEnv({
    NODE_ENV: 'production',
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '7d',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-openai-key',
    FRONTEND_URLS: 'http://localhost:3000',
  }, () => {
    assert.throws(() => validateEnv(), /FRONTEND_URLS/);
  });
});
