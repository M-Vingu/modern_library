const { Worker } = require('bullmq');
const { hasRedisConfigured, getRedisClient } = require('../services/redisClient');
const { logger } = require('../utils/logger');

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

  const settlementWorker = createWorker('settlement-generation', async (job) => ({
    processedAt: new Date().toISOString(),
    type: 'settlement-generation',
    payload: job.data,
  }));
  if (settlementWorker) workers.push(settlementWorker);

  const fileWorker = createWorker('file-post-processing', async (job) => ({
    processedAt: new Date().toISOString(),
    type: 'file-post-processing',
    payload: job.data,
  }));
  if (fileWorker) workers.push(fileWorker);

  const notificationWorker = createWorker('notifications', async (job) => ({
    processedAt: new Date().toISOString(),
    type: 'notifications',
    payload: job.data,
  }));
  if (notificationWorker) workers.push(notificationWorker);

  return workers;
}

module.exports = { startWorkers };
