const pino = require('pino');

const level = process.env.LOG_LEVEL || 'info';
const logger = pino({
  level,
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'refreshToken',
      'accessToken',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = { logger };
