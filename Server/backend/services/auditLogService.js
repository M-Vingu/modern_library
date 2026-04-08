const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');
const mongoose = require('mongoose');

async function writeAuditLog(req, event) {
  try {
    if (mongoose.connection.readyState !== 1) return;
    const actor = req.user?.id || req.user?._id;
    await AuditLog.create({
      actorUserId: actor || undefined,
      action: event.action,
      targetType: event.targetType || 'system',
      targetId: event.targetId ? String(event.targetId) : undefined,
      status: event.status || 'success',
      errorCode: event.errorCode,
      ipAddress: req.ip,
      userAgent: typeof req.get === 'function' ? req.get('user-agent') : undefined,
      requestId: req.requestId,
      metadata: event.metadata || undefined,
    });
  } catch (err) {
    logger.warn({ err: err.message, action: event.action }, 'audit_log_write_failed');
  }
}

module.exports = { writeAuditLog };
