const queues = require('../jobs/queues');
const jobDispatchService = require('../services/jobDispatchService');
const aiSessionMaintenanceService = require('../services/aiSessionMaintenanceService');
const { getMaintenanceConfig } = require('../services/aiRuntimeConfig');
const { hasRedisConfigured } = require('../services/redisClient');

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

const allowedQueues = [
  'settlement-generation',
  'file-post-processing',
  'notifications',
  'retention-sweep',
  'ai-session-maintenance',
];

async function queueMetrics(req, res) {
  const queueName = req.params.name;
  if (!allowedQueues.includes(queueName)) {
    return fail(res, 400, 'QUEUE_INVALID', 'Unsupported queue name');
  }
  const metrics = await queues.getQueueReport(queueName);
  return res.json({ success: true, ...metrics });
}

async function queueOverviewReport(_req, res) {
  const items = await Promise.all(allowedQueues.map((queueName) => queues.getQueueReport(queueName)));
  const maintenanceConfig = getMaintenanceConfig();

  return res.json({
    success: true,
    redisConfigured: hasRedisConfigured(),
    scheduler: {
      enabled: maintenanceConfig.schedulerEnabled,
      role: maintenanceConfig.schedulerRole,
      cron: maintenanceConfig.cron,
      inactiveDays: maintenanceConfig.inactiveDays,
      batchLimit: maintenanceConfig.batchLimit,
      retryAttempts: maintenanceConfig.retryAttempts,
      retryDelayMs: maintenanceConfig.retryDelayMs,
    },
    items,
  });
}

async function replayDeadLetterJob(req, res) {
  const queueName = req.params.name;
  const deadLetterJobId = req.body.deadLetterJobId;
  if (!allowedQueues.includes(queueName)) {
    return fail(res, 400, 'QUEUE_INVALID', 'Unsupported queue name');
  }
  if (!deadLetterJobId) {
    return fail(res, 400, 'QUEUE_JOB_ID_REQUIRED', 'deadLetterJobId is required');
  }
  const replay = await queues.replayDeadLetter(queueName, deadLetterJobId);
  if (!replay.replayed) {
    return fail(res, 404, 'QUEUE_REPLAY_FAILED', 'Dead-letter replay failed', replay);
  }
  return res.json({ success: true, replay });
}

async function dispatchAiMaintenanceJob(req, res) {
  if (req.params.name !== 'ai-session-maintenance') {
    return fail(res, 400, 'QUEUE_INVALID', 'Manual dispatch is only supported for ai-session-maintenance');
  }

  const payload = {
    sessionId: req.body.sessionId,
    status: req.body.status,
    inactiveDays: req.body.inactiveDays,
    limit: req.body.limit,
    retryAttempts: req.body.retryAttempts,
    retryDelayMs: req.body.retryDelayMs,
    archiveInactive: req.body.archiveInactive,
    requestId: req.requestId || null,
    triggeredBy: req.user?.id || null,
  };

  const result = await jobDispatchService.enqueueAiSessionMaintenance(payload, {
    jobId: `manual-ai-session-maintenance:${Date.now()}`,
  });

  if (!result.queued) {
    return fail(res, 503, 'QUEUE_UNAVAILABLE', 'AI maintenance queue is not available', result);
  }

  return res.json({ success: true, dispatched: true, queueName: req.params.name, ...result });
}

async function forceRunAiMaintenance(req, res) {
  if (req.params.name !== 'ai-session-maintenance') {
    return fail(res, 400, 'QUEUE_INVALID', 'Force-run is only supported for ai-session-maintenance');
  }

  const result = await aiSessionMaintenanceService.runAiSessionMaintenance({
    sessionId: req.body.sessionId,
    status: req.body.status,
    inactiveDays: req.body.inactiveDays,
    limit: req.body.limit,
    retryAttempts: req.body.retryAttempts,
    retryDelayMs: req.body.retryDelayMs,
    archiveInactive: req.body.archiveInactive,
    requestId: req.requestId || null,
  });

  return res.json({
    success: true,
    queueName: req.params.name,
    forced: true,
    ...result,
  });
}

module.exports = {
  allowedQueues,
  queueMetrics,
  queueOverviewReport,
  replayDeadLetterJob,
  dispatchAiMaintenanceJob,
  forceRunAiMaintenance,
};
