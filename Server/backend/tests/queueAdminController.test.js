const test = require('node:test');
const assert = require('node:assert/strict');

const queues = require('../jobs/queues');
const queueAdmin = require('../controllers/queueAdminController');
const jobDispatchService = require('../services/jobDispatchService');
const aiSessionMaintenanceService = require('../services/aiSessionMaintenanceService');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    fail(status, code, message, details) {
      this.statusCode = status;
      this.body = { success: false, error: { code, message, details } };
      return this;
    },
  };
}

test('queue admin: rejects unsupported queue names for metrics', async () => {
  const req = { params: { name: 'unknown-queue' } };
  const res = mockRes();

  await queueAdmin.queueMetrics(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'QUEUE_INVALID');
});

test('queue admin: returns queue metrics for supported queues', async () => {
  const originalGetQueueReport = queues.getQueueReport;
  queues.getQueueReport = async () => ({
    available: true,
    queueName: 'notifications',
    counts: { active: 1, completed: 2, failed: 0, waiting: 3, delayed: 0 },
    deadLetter: { available: true, counts: { active: 0, completed: 0, failed: 0, waiting: 1, delayed: 0 } },
  });

  const req = { params: { name: 'notifications' } };
  const res = mockRes();

  await queueAdmin.queueMetrics(req, res);

  queues.getQueueReport = originalGetQueueReport;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.queueName, 'notifications');
  assert.equal(res.body.counts.waiting, 3);
  assert.equal(res.body.deadLetter.counts.waiting, 1);
});

test('queue admin: supports ai session maintenance queue metrics', async () => {
  const originalGetQueueReport = queues.getQueueReport;
  queues.getQueueReport = async () => ({
    available: true,
    queueName: 'ai-session-maintenance',
    counts: { active: 0, completed: 5, failed: 1, waiting: 2, delayed: 0 },
    deadLetter: { available: true, counts: { active: 0, completed: 0, failed: 0, waiting: 0, delayed: 0 } },
  });

  const req = { params: { name: 'ai-session-maintenance' } };
  const res = mockRes();

  await queueAdmin.queueMetrics(req, res);

  queues.getQueueReport = originalGetQueueReport;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.queueName, 'ai-session-maintenance');
  assert.equal(res.body.counts.completed, 5);
});

test('queue admin: replays a dead-letter job for a supported queue', async () => {
  const originalReplayDeadLetter = queues.replayDeadLetter;
  queues.replayDeadLetter = async (queueName, deadLetterJobId) => ({
    replayed: true,
    queueName,
    deadLetterJobId,
  });

  const req = {
    params: { name: 'settlement-generation' },
    body: { deadLetterJobId: 'job-42' },
  };
  const res = mockRes();

  await queueAdmin.replayDeadLetterJob(req, res);

  queues.replayDeadLetter = originalReplayDeadLetter;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.replay.deadLetterJobId, 'job-42');
});

test('queue admin: reports replay failure when dead-letter job is missing', async () => {
  const originalReplayDeadLetter = queues.replayDeadLetter;
  queues.replayDeadLetter = async () => ({
    replayed: false,
    reason: 'dead_letter_job_not_found',
  });

  const req = {
    params: { name: 'settlement-generation' },
    body: { deadLetterJobId: 'missing-job' },
  };
  const res = mockRes();

  await queueAdmin.replayDeadLetterJob(req, res);

  queues.replayDeadLetter = originalReplayDeadLetter;

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'QUEUE_REPLAY_FAILED');
  assert.equal(res.body.error.details.reason, 'dead_letter_job_not_found');
});

test('queue admin: returns overview report for all queues', async () => {
  const originalGetQueueReport = queues.getQueueReport;
  queues.getQueueReport = async (queueName) => ({
    queueName,
    available: true,
    counts: { active: 0, completed: 1, failed: 0, waiting: 0, delayed: 0 },
    deadLetter: { available: true, counts: { active: 0, completed: 0, failed: 0, waiting: 0, delayed: 0 } },
  });

  const req = {};
  const res = mockRes();

  await queueAdmin.queueOverviewReport(req, res);

  queues.getQueueReport = originalGetQueueReport;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(Array.isArray(res.body.items), true);
  assert.ok(res.body.items.some((item) => item.queueName === 'ai-session-maintenance'));
});

test('queue admin: dispatches ai maintenance job to queue', async () => {
  const originalEnqueueAiSessionMaintenance = jobDispatchService.enqueueAiSessionMaintenance;
  jobDispatchService.enqueueAiSessionMaintenance = async () => ({
    queued: true,
    jobId: 'job-101',
  });

  const req = {
    params: { name: 'ai-session-maintenance' },
    body: { inactiveDays: 30, limit: 10 },
    requestId: 'req-1',
    user: { id: 'admin-1' },
  };
  const res = mockRes();

  await queueAdmin.dispatchAiMaintenanceJob(req, res);

  jobDispatchService.enqueueAiSessionMaintenance = originalEnqueueAiSessionMaintenance;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.dispatched, true);
  assert.equal(res.body.jobId, 'job-101');
});

test('queue admin: force-runs ai maintenance immediately', async () => {
  const originalRunAiSessionMaintenance = aiSessionMaintenanceService.runAiSessionMaintenance;
  aiSessionMaintenanceService.runAiSessionMaintenance = async () => ({
    success: true,
    processedCount: 1,
    updatedCount: 1,
    failedCount: 0,
    items: [{ sessionId: 'session-1', success: true }],
  });

  const req = {
    params: { name: 'ai-session-maintenance' },
    body: { sessionId: 'session-1', limit: 1 },
    requestId: 'req-2',
  };
  const res = mockRes();

  await queueAdmin.forceRunAiMaintenance(req, res);

  aiSessionMaintenanceService.runAiSessionMaintenance = originalRunAiSessionMaintenance;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.forced, true);
  assert.equal(res.body.processedCount, 1);
});
