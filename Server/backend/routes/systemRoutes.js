const express = require('express');
const mongoose = require('mongoose');
const { getRedisHealth } = require('../services/redisClient');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'modern-library-api',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const redis = await getRedisHealth();
  const ready = dbReady && (redis.status === 'ok' || redis.status === 'skipped');

  const payload = {
    status: ready ? 'ready' : 'not_ready',
    dependencies: {
      mongo: dbReady ? 'ok' : 'down',
      redis: redis.status,
    },
    timestamp: new Date().toISOString(),
  };

  return res.status(ready ? 200 : 503).json(payload);
});

module.exports = router;
