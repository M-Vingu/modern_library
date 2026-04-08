const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { queueReplaySchema } = require('../validations/legacySchemas');
const { queueMetrics, replayDeadLetterJob } = require('../controllers/queueAdminController');

router.get('/:name/metrics', protect, authorizeRoles('admin'), queueMetrics);
router.post('/:name/dead-letter/replay', protect, authorizeRoles('admin'), validateRequest(queueReplaySchema), replayDeadLetterJob);

module.exports = router;
