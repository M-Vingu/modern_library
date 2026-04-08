const test = require('node:test');
const assert = require('node:assert/strict');
const { hasRedisConfigured } = require('../services/redisClient');

test('redis env-gated realtime test scaffold', { skip: !process.env.REDIS_URL }, async () => {
  assert.equal(hasRedisConfigured(), true);
});
