const { enqueue } = require('../jobs/queues');

async function enqueueRetentionSweep(payload) {
  return enqueue('retention-sweep', 'retention-sweep-run', payload);
}

module.exports = { enqueueRetentionSweep };
