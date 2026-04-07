const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

async function writeAuditLog(req, event) {
  try {
    const actor = req.user?.id || req.user?._id;
    await AuditLog.create({
      actorUserId: actor || undefined,
      action: event.action,
      targetType: event.targetType || 'system',
      targetId: event.targetId ? String(event.targetId) : undefined,
      status: event.status || 'success',
      errorCode: event.errorCode,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
      metadata: event.metadata || undefined,
    });
  } catch (err) {
    logger.warn({ err: err.message, action: event.action }, 'audit_log_write_failed');
  }
}

module.exports = { writeAuditLog };
