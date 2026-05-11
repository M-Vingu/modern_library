const test = require('node:test');
const assert = require('node:assert/strict');

const { registerSchema } = require('../validations/authSchemas');
const { userRegisterSchema } = require('../validations/userSchemas');

test('auth register schema enforces strong passwords and defaults to supported public roles only', () => {
  const weak = registerSchema.safeParse({
    body: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'weakpass',
      role: 'admin',
    },
    params: {},
    query: {},
  });

  assert.equal(weak.success, false);
});

test('legacy user register schema enforces strong passwords', () => {
  const result = userRegisterSchema.safeParse({
    body: {
      name: 'Legacy User',
      email: 'legacy@example.com',
      password: 'passwordonly',
    },
    params: {},
    query: {},
  });

  assert.equal(result.success, false);
});
