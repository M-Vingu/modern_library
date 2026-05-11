const { Queue, QueueEvents } = require('bullmq');
const { getRedisClient, hasRedisConfigured } = require('../services/redisClient');
const { logger } = require('../utils/logger');

const queueRegistry = new Map();
const queueEventsRegistry = new Map();

function getConnection() {
  if (!hasRedisConfigured()) return null;
  return getRedisClient();
}

function getQueue(name) {
  if (queueRegistry.has(name)) return queueRegistry.get(name);
  const connection = getConnection();
  if (!connection) return null;

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: Number(process.env.JOB_ATTEMPTS || 5),
      backoff: { type: 'exponential', delay: Number(process.env.JOB_BACKOFF_MS || 3000) },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });
  queueRegistry.set(name, queue);

  const queueEvents = new QueueEvents(name, { connection });
  queueEvents.on('failed', async ({ jobId, failedReason }) => {
    try {
      const deadLetter = getQueue(`${name}:dead-letter`);
      if (deadLetter) {
        await deadLetter.add('failed-job', { sourceQueue: name, jobId, failedReason });
      }
    } catch (err) {
      logger.error({ err: err.message, queue: name, jobId }, 'dead_letter_enqueue_failed');
    }
  });
  queueEventsRegistry.set(name, queueEvents);

  return queue;
}

async function enqueue(queueName, jobName, payload, options = {}) {
  const queue = getQueue(queueName);
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  const job = await queue.add(jobName, payload, options);
  return { queued: true, jobId: job.id };
}

async function replayDeadLetter(queueName, deadLetterJobId) {
  const deadLetterQueue = getQueue(`${queueName}:dead-letter`);
  const mainQueue = getQueue(queueName);
  if (!deadLetterQueue || !mainQueue) return { replayed: false, reason: 'queue_not_available' };

  const deadLetterJob = await deadLetterQueue.getJob(deadLetterJobId);
  if (!deadLetterJob) return { replayed: false, reason: 'dead_letter_job_not_found' };
  await mainQueue.add('replayed-job', deadLetterJob.data);
  return { replayed: true, deadLetterJobId };
}

async function getQueueMetrics(queueName) {
  const queue = getQueue(queueName);
  if (!queue) return { available: false, reason: 'queue_not_available' };
  const counts = await queue.getJobCounts('active', 'completed', 'failed', 'waiting', 'delayed');
  return { available: true, queueName, counts };
}

async function getQueueReport(queueName) {
  const metrics = await getQueueMetrics(queueName);
  const deadLetterMetrics = await getQueueMetrics(`${queueName}:dead-letter`);

  return {
    queueName,
    available: metrics.available,
    reason: metrics.reason,
    counts: metrics.counts || null,
    deadLetter: {
      available: deadLetterMetrics.available,
      reason: deadLetterMetrics.reason,
      counts: deadLetterMetrics.counts || null,
    },
  };
}

module.exports = {
  getQueue,
  enqueue,
  replayDeadLetter,
  getQueueMetrics,
  getQueueReport,
};
