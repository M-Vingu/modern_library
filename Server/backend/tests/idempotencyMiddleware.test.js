const test = require('node:test');
const assert = require('node:assert/strict');

const IdempotencyKey = require('../models/IdempotencyKey');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const { createMockRes } = require('./testUtils');

test('idempotency middleware replays a stored response for the same user and route key', async () => {
  const originalFindOne = IdempotencyKey.findOne;
  const originalFindOneAndUpdate = IdempotencyKey.findOneAndUpdate;

  IdempotencyKey.findOne = () => ({
    lean: async () => ({
      statusCode: 201,
      responseBody: { success: true, bookingId: 'cached-booking' },
    }),
  });
  IdempotencyKey.findOneAndUpdate = async () => {
    throw new Error('should not persist a new response when cache hit exists');
  };

  const req = {
    method: 'POST',
    originalUrl: '/api/partners/cab-bookings',
    headers: { 'idempotency-key': 'abc-123' },
    user: { id: '507f1f77bcf86cd799439011' },
  };
  const res = createMockRes();
  let nextCalled = false;

  await idempotencyMiddleware()(req, res, () => {
    nextCalled = true;
  });

  IdempotencyKey.findOne = originalFindOne;
  IdempotencyKey.findOneAndUpdate = originalFindOneAndUpdate;

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { success: true, bookingId: 'cached-booking' });
});

test('idempotency middleware stores first successful response for later replays', async () => {
  const originalFindOne = IdempotencyKey.findOne;
  const originalFindOneAndUpdate = IdempotencyKey.findOneAndUpdate;
  const writes = [];

  IdempotencyKey.findOne = () => ({
    lean: async () => null,
  });
  IdempotencyKey.findOneAndUpdate = async (_filter, update) => {
    writes.push(update.$setOnInsert);
    return null;
  };

  const req = {
    method: 'PATCH',
    originalUrl: '/api/partners/cab-bookings/507f1f77bcf86cd799439022/status',
    headers: { 'idempotency-key': 'finish-booking' },
    user: { id: '507f1f77bcf86cd799439011' },
  };
  const res = createMockRes();
  let nextCalled = false;

  await idempotencyMiddleware()(req, res, () => {
    nextCalled = true;
  });
  await res.status(200).json({ success: true, status: 'completed' });

  IdempotencyKey.findOne = originalFindOne;
  IdempotencyKey.findOneAndUpdate = originalFindOneAndUpdate;

  assert.equal(nextCalled, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, 'PATCH');
  assert.equal(writes[0].route, '/api/partners/cab-bookings/507f1f77bcf86cd799439022/status');
  assert.equal(writes[0].statusCode, 200);
  assert.deepEqual(writes[0].responseBody, { success: true, status: 'completed' });
});
