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

async function enqueue(queueName, jobName, payload) {
  const queue = getQueue(queueName);
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  const job = await queue.add(jobName, payload);
  return { queued: true, jobId: job.id };
}

module.exports = { getQueue, enqueue };
