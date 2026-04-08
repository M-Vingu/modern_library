const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  consentSchema,
  dsarSchema,
  dsarStatusSchema,
  retentionPolicySchema,
  dsarListSchema,
  retentionSweepSchema,
} = require('../validations/complianceSchemas');
const {
  recordConsent,
  requestDsarExport,
  requestDsarDelete,
  listDsarRequests,
  getDsarRequest,
  updateDsarStatus,
  triggerRetentionSweep,
  upsertRetentionPolicy,
  listRetentionPolicies,
} = require('../controllers/complianceController');

router.post('/consent', protect, validateRequest(consentSchema), recordConsent);
router.post('/dsar/export', protect, validateRequest(dsarSchema), requestDsarExport);
router.post('/dsar/delete', protect, validateRequest(dsarSchema), requestDsarDelete);
router.get('/dsar/:id', protect, getDsarRequest);
router.patch('/dsar/:id/status', protect, authorizeRoles('admin'), validateRequest(dsarStatusSchema), updateDsarStatus);
router.post('/retention/sweep', protect, authorizeRoles('admin'), validateRequest(retentionSweepSchema), triggerRetentionSweep);
router.put('/retention/policies', protect, authorizeRoles('admin'), validateRequest(retentionPolicySchema), upsertRetentionPolicy);
router.get('/retention/policies', protect, authorizeRoles('admin'), listRetentionPolicies);
router.get('/dsar', protect, authorizeRoles('admin'), validateRequest(dsarListSchema), listDsarRequests);

module.exports = router;
