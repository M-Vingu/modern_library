const { enqueue } = require('../jobs/queues');

async function enqueueSettlementGeneration(payload) {
  return enqueue('settlement-generation', 'generate-settlement', payload);
}

async function enqueueFilePostProcessing(payload) {
  return enqueue('file-post-processing', 'post-process-file', payload);
}

async function enqueueNotification(payload) {
  return enqueue('notifications', 'send-notification', payload);
}

async function enqueueAiSessionMaintenance(payload, options) {
  return enqueue('ai-session-maintenance', 'resummarize-sessions', payload, options);
}

module.exports = {
  enqueueSettlementGeneration,
  enqueueFilePostProcessing,
  enqueueNotification,
  enqueueAiSessionMaintenance,
};
