require('dotenv').config();
const { startWorkers, shutdownWorkers } = require('./worker');
const { logger } = require('../utils/logger');

const workers = startWorkers();
if (!workers.length) {
  logger.warn('No workers started. Set REDIS_URL before running worker process.');
} else {
  logger.info({ workers: workers.length }, 'Workers started');
}

let isShuttingDown = false;
async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Worker shutdown initiated');
  await shutdownWorkers(workers);
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
