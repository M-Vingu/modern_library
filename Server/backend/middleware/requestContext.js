const crypto = require('crypto');

function requestContext(req, res, next) {
  const existing = req.headers['x-request-id'];
  const requestId = typeof existing === 'string' && existing.trim()
    ? existing.trim()
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = requestContext;
