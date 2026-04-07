function hasDangerousKey(value) {
  if (!value || typeof value !== 'object') return false;

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }

    if (hasDangerousKey(value[key])) return true;
  }

  return false;
}

function sanitizeRequest(req, res, next) {
  if (hasDangerousKey(req.body) || hasDangerousKey(req.query) || hasDangerousKey(req.params)) {
    return res.status(400).json({ message: 'Invalid request payload' });
  }
  next();
}

module.exports = sanitizeRequest;
