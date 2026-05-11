const express = require('express');
const mongoose = require('mongoose');
const { getRedisHealth } = require('../services/redisClient');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { getAiTelemetryReport } = require('../services/aiTelemetryService');
const { allowedQueues } = require('../controllers/queueAdminController');
const { getQueueReport } = require('../jobs/queues');

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

router.get('/ops-report', protect, authorizeRoles('admin'), async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const redis = await getRedisHealth();
  const queueItems = await Promise.all(allowedQueues.map((queueName) => getQueueReport(queueName)));
  const aiChatTelemetry = await getAiTelemetryReport({ range: 'daily', endpoint: 'ai.chat' });

  const totalAiRequests = Number(aiChatTelemetry.summary.totalRequests || 0);
  const failedAiRequests = totalAiRequests - Number(aiChatTelemetry.summary.successCount || 0);
  const aiErrorRate = totalAiRequests > 0 ? failedAiRequests / totalAiRequests : 0;
  const failedQueueCount = queueItems.reduce((total, item) => total + Number(item.counts?.failed || 0), 0);
  const waitingDeadLetters = queueItems.reduce((total, item) => total + Number(item.deadLetter?.counts?.waiting || 0), 0);

  const alerts = [];
  const aiErrorRateThreshold = Number(process.env.AI_CHAT_ERROR_RATE_ALERT_THRESHOLD || 0.1);
  const queueFailedThreshold = Number(process.env.QUEUE_FAILED_JOBS_ALERT_THRESHOLD || 1);

  if (!dbReady) alerts.push({ severity: 'critical', code: 'MONGO_DOWN', message: 'MongoDB is not connected.' });
  if (redis.status === 'down') alerts.push({ severity: 'critical', code: 'REDIS_DOWN', message: 'Redis is unavailable.' });
  if (aiErrorRate >= aiErrorRateThreshold) {
    alerts.push({
      severity: 'warning',
      code: 'AI_CHAT_ERROR_RATE_HIGH',
      message: `AI chat error rate is ${Math.round(aiErrorRate * 100)}%.`,
    });
  }
  if (failedQueueCount >= queueFailedThreshold) {
    alerts.push({
      severity: 'warning',
      code: 'QUEUE_FAILURES_PRESENT',
      message: `There are ${failedQueueCount} failed queue jobs.`,
    });
  }
  if (waitingDeadLetters > 0) {
    alerts.push({
      severity: 'warning',
      code: 'DEAD_LETTER_BACKLOG',
      message: `There are ${waitingDeadLetters} dead-letter jobs awaiting replay.`,
    });
  }

  return res.json({
    success: true,
    service: 'modern-library-api',
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    dependencies: {
      mongo: dbReady ? 'ok' : 'down',
      redis: redis.status,
    },
    aiChat: {
      requests24h: totalAiRequests,
      failed24h: failedAiRequests,
      errorRate24h: Number(aiErrorRate.toFixed(4)),
      avgResponseTimeMs: aiChatTelemetry.summary.avgResponseTimeMs,
      fallbackCount24h: aiChatTelemetry.summary.fallbackCount,
    },
    queues: queueItems,
    alerts,
  });
});

module.exports = router;
