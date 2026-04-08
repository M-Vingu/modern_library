const test = require('node:test');
const assert = require('node:assert/strict');

const { sendNotification, buildMessage } = require('../services/notificationProviderService');

test('notification provider builds MFA OTP message', () => {
  const message = buildMessage({ template: 'mfa_otp', data: { otp: '123456', expiresInMin: 5 } });
  assert.match(message.subject, /OTP/i);
  assert.match(message.text, /123456/);
});

test('notification provider uses log email provider by default', async () => {
  delete process.env.NOTIFICATION_EMAIL_PROVIDER;
  const result = await sendNotification({
    channel: 'email',
    to: 'user@example.com',
    template: 'mfa_otp',
    data: { otp: '999111', expiresInMin: 5 },
  });
  assert.equal(result.delivered, true);
  assert.equal(result.provider, 'log');
});
