const buckets = new Map();

function createRateLimiter({ windowMs, max, keyPrefix = 'global' }) {
  return (req, res, next) => {
    const key = `${keyPrefix}:${req.ip || req.connection?.remoteAddress || 'unknown'}`;
    const now = Date.now();

    const entry = buckets.get(key);
    if (!entry || entry.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSec = Math.ceil((entry.expiresAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ message: 'Too many requests, slow down.' });
    }

    entry.count += 1;
    buckets.set(key, entry);
    next();
  };
}

module.exports = { createRateLimiter };
