const cron = require('node-cron');
const { hasRedisConfigured } = require('../services/redisClient');
const { enqueueAiSessionMaintenance } = require('../services/jobDispatchService');
const { getMaintenanceConfig } = require('../services/aiRuntimeConfig');
const { runAiSessionMaintenance } = require('../services/aiSessionMaintenanceService');
const { logger } = require('../utils/logger');

function startAiMaintenanceScheduler({ role = 'api' } = {}) {
  const config = getMaintenanceConfig();
  if (!config.schedulerEnabled || config.schedulerRole !== role) return null;

  let running = false;
  const task = cron.schedule(config.cron, async () => {
    if (running) {
      logger.warn({ role }, 'ai_session_maintenance_scheduler_skipped_overlap');
      return;
    }

    running = true;
    try {
      if (hasRedisConfigured()) {
        const scheduledAt = new Date().toISOString();
        await enqueueAiSessionMaintenance({
          scheduledAt,
          inactiveDays: config.inactiveDays,
          limit: config.batchLimit,
          retryAttempts: config.retryAttempts,
          retryDelayMs: config.retryDelayMs,
        }, {
          jobId: `ai-session-maintenance:${scheduledAt.slice(0, 16)}`,
        });
      } else {
        await runAiSessionMaintenance({
          inactiveDays: config.inactiveDays,
          limit: config.batchLimit,
          retryAttempts: config.retryAttempts,
          retryDelayMs: config.retryDelayMs,
          requestId: `cron:${Date.now()}`,
        });
      }
    } catch (err) {
      logger.error({ err: err.message, role }, 'ai_session_maintenance_scheduler_failed');
    } finally {
      running = false;
    }
  }, { scheduled: true });

  logger.info({
    role,
    cron: config.cron,
    redisBacked: hasRedisConfigured(),
  }, 'ai_session_maintenance_scheduler_started');

  return task;
}

module.exports = { startAiMaintenanceScheduler };
