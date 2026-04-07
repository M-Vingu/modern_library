function responseEnvelope(_req, res, next) {
  res.fail = (status, code, message, details) => (
    res.status(status).json({
      success: false,
      error: {
        code,
        message,
        details: details || undefined,
      },
      requestId: res.getHeader('X-Request-Id'),
    })
  );
  next();
}

module.exports = responseEnvelope;
