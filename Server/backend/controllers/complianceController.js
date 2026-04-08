const ConsentRecord = require('../models/ConsentRecord');
const DSARRequest = require('../models/DSARRequest');
const RetentionPolicy = require('../models/RetentionPolicy');
const { writeAuditLog } = require('../services/auditLogService');
const { enqueueRetentionSweep } = require('../services/retentionService');

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

async function recordConsent(req, res) {
  try {
    const item = await ConsentRecord.create({
      userId: req.user.id,
      policyType: req.body.policyType,
      policyVersion: req.body.policyVersion,
      metadata: req.body.metadata || {},
    });
    await writeAuditLog(req, {
      action: 'compliance.consent_recorded',
      targetType: 'consent',
      targetId: item._id,
      metadata: { policyType: item.policyType, policyVersion: item.policyVersion },
    });
    return res.status(201).json({ success: true, item });
  } catch (err) {
    if (String(err.message).includes('duplicate key')) {
      return fail(res, 409, 'COMPLIANCE_CONSENT_EXISTS', 'Consent already recorded for this policy version');
    }
    return fail(res, 400, 'COMPLIANCE_CONSENT_FAILED', err.message);
  }
}

async function requestDsarExport(req, res) {
  const item = await DSARRequest.create({
    userId: req.user.id,
    requestType: 'export',
    reason: req.body.reason,
  });
  await writeAuditLog(req, {
    action: 'compliance.dsar_export_requested',
    targetType: 'dsar_request',
    targetId: item._id,
  });
  return res.status(201).json({ success: true, item });
}

async function requestDsarDelete(req, res) {
  const item = await DSARRequest.create({
    userId: req.user.id,
    requestType: 'delete',
    reason: req.body.reason,
  });
  await writeAuditLog(req, {
    action: 'compliance.dsar_delete_requested',
    targetType: 'dsar_request',
    targetId: item._id,
  });
  return res.status(201).json({ success: true, item });
}

async function getDsarRequest(req, res) {
  const item = await DSARRequest.findById(req.params.id);
  if (!item) return fail(res, 404, 'COMPLIANCE_DSAR_NOT_FOUND', 'DSAR request not found');
  if (req.user.role !== 'admin' && item.userId.toString() !== req.user.id) {
    return fail(res, 403, 'COMPLIANCE_FORBIDDEN', 'Forbidden DSAR access');
  }
  return res.json({ success: true, item });
}

async function listDsarRequests(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'COMPLIANCE_FORBIDDEN', 'Admin only');

  const {
    status,
    requestType,
    userId,
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (requestType) filter.requestType = requestType;
  if (userId) filter.userId = userId;

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const items = await DSARRequest.find(filter)
    .sort({ requestedAt: -1, createdAt: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .populate('userId', 'name email role');
  const total = await DSARRequest.countDocuments(filter);

  return res.json({
    success: true,
    page: safePage,
    limit: safeLimit,
    total,
    items,
  });
}

async function updateDsarStatus(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'COMPLIANCE_FORBIDDEN', 'Admin only');
  const item = await DSARRequest.findById(req.params.id);
  if (!item) return fail(res, 404, 'COMPLIANCE_DSAR_NOT_FOUND', 'DSAR request not found');

  item.status = req.body.status;
  item.resolutionNotes = req.body.resolutionNotes;
  if (['completed', 'rejected'].includes(item.status)) item.completedAt = new Date();
  await item.save();

  await writeAuditLog(req, {
    action: 'compliance.dsar_status_updated',
    targetType: 'dsar_request',
    targetId: item._id,
    metadata: { status: item.status },
  });
  return res.json({ success: true, item });
}

async function triggerRetentionSweep(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'COMPLIANCE_FORBIDDEN', 'Admin only');
  const result = await enqueueRetentionSweep({ initiatedBy: req.user.id, requestedAt: new Date().toISOString() });
  return res.status(202).json({ success: true, result });
}

async function upsertRetentionPolicy(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'COMPLIANCE_FORBIDDEN', 'Admin only');
  const item = await RetentionPolicy.findOneAndUpdate(
    { collection: req.body.collection },
    {
      $set: {
        retentionDays: req.body.retentionDays,
        mode: req.body.mode || 'soft_delete',
        active: req.body.active !== undefined ? req.body.active : true,
        notes: req.body.notes,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  return res.json({ success: true, item });
}

async function listRetentionPolicies(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'COMPLIANCE_FORBIDDEN', 'Admin only');
  const items = await RetentionPolicy.find().sort({ collection: 1 });
  return res.json({ success: true, items });
}

module.exports = {
  recordConsent,
  requestDsarExport,
  requestDsarDelete,
  listDsarRequests,
  getDsarRequest,
  updateDsarStatus,
  triggerRetentionSweep,
  upsertRetentionPolicy,
  listRetentionPolicies,
};
