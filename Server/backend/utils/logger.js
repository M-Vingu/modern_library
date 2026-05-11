const pino = require('pino');

const level = process.env.LOG_LEVEL || 'info';
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const logger = pino({
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'req.headers["set-cookie"]',
      'password',
      'token',
      'refreshToken',
      'accessToken',
      'otp',
      'otpPreview',
      'challengeId',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  serializers: {
    err(error) {
      if (!error) return error;
      return {
        type: error.name,
        message: error.message,
        code: error.code,
        status: error.status,
        ...(isProduction ? {} : { stack: error.stack }),
      };
    },
  },
});

module.exports = { logger };
