require('dotenv').config();
const { startWorkers } = require('./worker');
const { logger } = require('../utils/logger');

const workers = startWorkers();
if (!workers.length) {
  logger.warn('No workers started. Set REDIS_URL before running worker process.');
} else {
  logger.info({ workers: workers.length }, 'Workers started');
}
