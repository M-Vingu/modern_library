const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const protect = require('../middleware/authMiddleware');
const User = require('../models/user');
const { createMockRes } = require('./testUtils');

test('auth middleware rejects missing bearer token', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const req = { headers: {} };
  const res = createMockRes();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('auth middleware accepts valid token and sets req.user', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, { algorithm: 'HS256' });

  const originalFindById = User.findById;
  User.findById = () => ({
    select: async () => ({ _id: '507f1f77bcf86cd799439011', role: 'user' }),
  });

  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createMockRes();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  User.findById = originalFindById;

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, '507f1f77bcf86cd799439011');
  assert.equal(req.user.role, 'user');
});
