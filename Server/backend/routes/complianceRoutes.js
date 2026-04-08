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
} = require('../validations/complianceSchemas');
const {
  recordConsent,
  requestDsarExport,
  requestDsarDelete,
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
router.post('/retention/sweep', protect, authorizeRoles('admin'), triggerRetentionSweep);
router.put('/retention/policies', protect, authorizeRoles('admin'), validateRequest(retentionPolicySchema), upsertRetentionPolicy);
router.get('/retention/policies', protect, authorizeRoles('admin'), listRetentionPolicies);
router.get('/dsar', protect, authorizeRoles('admin'), async (_req, res) => res.fail(501, 'COMPLIANCE_DSAR_LIST_NOT_IMPLEMENTED', 'DSAR listing endpoint is scaffolded and not yet implemented'));

module.exports = router;
