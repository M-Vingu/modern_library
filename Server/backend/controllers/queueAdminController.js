const { getQueueMetrics, replayDeadLetter } = require('../jobs/queues');

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

const allowedQueues = ['settlement-generation', 'file-post-processing', 'notifications', 'retention-sweep'];

async function queueMetrics(req, res) {
  const queueName = req.params.name;
  if (!allowedQueues.includes(queueName)) {
    return fail(res, 400, 'QUEUE_INVALID', 'Unsupported queue name');
  }
  const metrics = await getQueueMetrics(queueName);
  return res.json({ success: true, ...metrics });
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
  const replay = await replayDeadLetter(queueName, deadLetterJobId);
  if (!replay.replayed) {
    return fail(res, 404, 'QUEUE_REPLAY_FAILED', 'Dead-letter replay failed', replay);
  }
  return res.json({ success: true, replay });
}

module.exports = { queueMetrics, replayDeadLetterJob };
