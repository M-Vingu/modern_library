const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  aiMaintenanceQueueActionSchema,
  queueReplaySchema,
  queueReportSchema,
} = require('../validations/queueSchemas');
const {
  queueMetrics,
  queueOverviewReport,
  replayDeadLetterJob,
  dispatchAiMaintenanceJob,
  forceRunAiMaintenance,
} = require('../controllers/queueAdminController');

router.get('/report', protect, authorizeRoles('admin'), validateRequest(queueReportSchema), queueOverviewReport);
router.get('/:name/metrics', protect, authorizeRoles('admin'), queueMetrics);
router.post('/:name/dead-letter/replay', protect, authorizeRoles('admin'), validateRequest(queueReplaySchema), replayDeadLetterJob);
router.post('/:name/dispatch', protect, authorizeRoles('admin'), validateRequest(aiMaintenanceQueueActionSchema), dispatchAiMaintenanceJob);
router.post('/:name/run-now', protect, authorizeRoles('admin'), validateRequest(aiMaintenanceQueueActionSchema), forceRunAiMaintenance);

module.exports = router;
