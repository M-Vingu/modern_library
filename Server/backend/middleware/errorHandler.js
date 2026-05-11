const { logger } = require('../utils/logger');
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

function notFoundHandler(req, res) {
  if (typeof res.fail === 'function') {
    return res.fail(404, 'ROUTE_NOT_FOUND', 'Route not found');
  }
  return res.status(404).json({ message: 'Route not found' });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = status >= 500 && isProduction
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  logger.error({
    err,
    requestId: req.requestId,
    path: req.originalUrl,
    method: req.method,
  }, 'request_error');

  if (res.headersSent) return;
  if (typeof res.fail === 'function') {
    return res.fail(status, code, message, err.details);
  }
  res.status(status).json({ message });
}

module.exports = { notFoundHandler, errorHandler };
