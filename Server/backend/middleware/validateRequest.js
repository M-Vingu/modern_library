function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      if (typeof res.fail === 'function') {
        return res.fail(400, 'VALIDATION_ERROR', 'Request validation failed', { issues });
      }
      return res.status(400).json({ message: 'Request validation failed', issues });
    }
    req.validated = result.data;
    return next();
  };
}

module.exports = { validateRequest };
