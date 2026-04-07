const IdempotencyKey = require('../models/IdempotencyKey');

function idempotencyMiddleware({ ttlSec = 60 * 60 * 24 } = {}) {
  return async (req, res, next) => {
    try {
      const keyHeader = req.headers['idempotency-key'];
      const key = typeof keyHeader === 'string' ? keyHeader.trim() : '';
      if (!key) return next();
      if (!req.user?.id && !req.user?._id) return next();

      const userId = req.user.id || req.user._id;
      const fullKey = `${userId}:${req.method}:${req.originalUrl}:${key}`;
      const existing = await IdempotencyKey.findOne({ key: fullKey }).lean();
      if (existing) {
        return res.status(existing.statusCode).json(existing.responseBody);
      }

      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        const statusCode = res.statusCode || 200;
        if (statusCode >= 200 && statusCode < 500) {
          await IdempotencyKey.findOneAndUpdate(
            { key: fullKey },
            {
              $setOnInsert: {
                key: fullKey,
                userId,
                route: req.originalUrl,
                method: req.method,
                statusCode,
                responseBody: body,
                expiresAt: new Date(Date.now() + ttlSec * 1000),
              },
            },
            { upsert: true },
          );
        }
        return originalJson(body);
      };

      return next();
    } catch (_err) {
      return next();
    }
  };
}

module.exports = { idempotencyMiddleware };
