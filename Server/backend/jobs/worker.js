const { Worker } = require('bullmq');
const { hasRedisConfigured, getRedisClient } = require('../services/redisClient');
const { logger } = require('../utils/logger');
const SettlementLedger = require('../models/SettlementLedger');
const PastPaper = require('../models/PastPaper');
const DSARRequest = require('../models/DSARRequest');
const RetentionPolicy = require('../models/RetentionPolicy');
const { sendNotification } = require('../services/notificationProviderService');

function createWorker(queueName, processor) {
  if (!hasRedisConfigured()) return null;
  const worker = new Worker(queueName, processor, {
    connection: getRedisClient(),
    concurrency: Number(process.env.JOB_WORKER_CONCURRENCY || 5),
  });

  worker.on('completed', (job) => {
    logger.info({ queue: queueName, jobId: job.id }, 'job_completed');
  });
  worker.on('failed', (job, err) => {
    logger.error({ queue: queueName, jobId: job?.id, err: err.message }, 'job_failed');
  });
  return worker;
}

function startWorkers() {
  const workers = [];

  const settlementWorker = createWorker('settlement-generation', async (job) => {
    const { settlementId } = job.data || {};
    if (!settlementId) return { skipped: true, reason: 'missing_settlement_id' };
    const item = await SettlementLedger.findById(settlementId);
    if (!item) return { skipped: true, reason: 'not_found' };
    if (item.status === 'pending') {
      item.status = 'processing';
      await item.save();
    }
    return { processedAt: new Date().toISOString(), settlementId: item._id.toString(), status: item.status };
  });
  if (settlementWorker) workers.push(settlementWorker);

  const fileWorker = createWorker('file-post-processing', async (job) => {
    const { pastPaperId } = job.data || {};
    if (!pastPaperId) return { skipped: true, reason: 'missing_past_paper_id' };
    const item = await PastPaper.findById(pastPaperId);
    if (!item) return { skipped: true, reason: 'not_found' };
    // Scaffold: attach file processing metadata for later antivirus/transcoding pipeline.
    item.processingMeta = {
      lastProcessedAt: new Date(),
      pipeline: 'scaffold-v1',
    };
    await item.save();
    return { processedAt: new Date().toISOString(), pastPaperId: item._id.toString() };
  });
  if (fileWorker) workers.push(fileWorker);

  const notificationWorker = createWorker('notifications', async (job) => {
    const payload = job.data || {};
    const result = await sendNotification(payload);
    if (!result.delivered && payload.requireDelivery) {
      throw new Error(`notification_delivery_failed:${result.reason || 'unknown'}`);
    }
    return {
      processedAt: new Date().toISOString(),
      channel: payload.channel || 'in_app',
      provider: result.provider,
      delivered: result.delivered,
      reason: result.reason,
      messageId: result.messageId || null,
    };
  });
  if (notificationWorker) workers.push(notificationWorker);

  const retentionWorker = createWorker('retention-sweep', async (_job) => {
    const policies = await RetentionPolicy.find({ active: true });
    const now = Date.now();
    let touched = 0;
    for (const policy of policies) {
      const threshold = new Date(now - Number(policy.retentionDays || 0) * 24 * 60 * 60 * 1000);
      if (policy.collection === 'dsarrequests') {
        const result = await DSARRequest.updateMany(
          { createdAt: { $lt: threshold }, status: { $in: ['completed', 'rejected'] } },
          { $set: { archivedAt: new Date() } },
        );
        touched += Number(result.modifiedCount || 0);
      }
    }
    return { processedAt: new Date().toISOString(), policies: policies.length, touched };
  });
  if (retentionWorker) workers.push(retentionWorker);

  return workers;
}

async function shutdownWorkers(workers) {
  if (!Array.isArray(workers)) return;
  await Promise.all(workers.map(async (worker) => {
    try {
      await worker.close();
    } catch (err) {
      logger.warn({ err: err.message }, 'worker_shutdown_failed');
    }
  }));
}

module.exports = { startWorkers, shutdownWorkers };
