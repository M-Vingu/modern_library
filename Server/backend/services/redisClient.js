let redisInstance = null;
let redisFactoryLoaded = false;
let Redis;

function hasRedisConfigured() {
  return Boolean(process.env.REDIS_URL);
}

function getRedisClient() {
  if (!hasRedisConfigured()) return null;
  if (redisInstance) return redisInstance;

  if (!redisFactoryLoaded) {
    // Lazy load to keep local development working without Redis package usage.
    // eslint-disable-next-line global-require
    Redis = require('ioredis');
    redisFactoryLoaded = true;
  }

  redisInstance = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  });
  return redisInstance;
}

async function getRedisHealth() {
  if (!hasRedisConfigured()) return { configured: false, status: 'skipped' };
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return { configured: true, status: pong === 'PONG' ? 'ok' : 'degraded' };
  } catch (err) {
    return { configured: true, status: 'down', error: err.message };
  }
}

module.exports = { getRedisClient, getRedisHealth, hasRedisConfigured };
