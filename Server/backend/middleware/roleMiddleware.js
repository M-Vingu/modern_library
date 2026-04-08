function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      if (typeof res.fail === 'function') return res.fail(401, 'AUTH_UNAUTHORIZED', 'Unauthorized');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      if (typeof res.fail === 'function') return res.fail(403, 'AUTH_FORBIDDEN', 'Forbidden');
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = { authorizeRoles };
