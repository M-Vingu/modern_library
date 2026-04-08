const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { createKidProfileSchema, kidProgressSchema, parentControlSchema } = require('../validations/kidsSchemas');
const {
  createKidProfile,
  listKidProfiles,
  listKidContent,
  upsertKidProgress,
  getKidRewards,
  upsertParentControl,
  listKidSafetyEvents,
} = require('../controllers/kidsController');

router.post('/profiles', protect, authorizeRoles('parent', 'admin'), validateRequest(createKidProfileSchema), createKidProfile);
router.get('/profiles', protect, authorizeRoles('parent', 'admin'), listKidProfiles);
router.get('/content', protect, authorizeRoles('kid', 'parent', 'admin'), listKidContent);
router.post('/progress', protect, authorizeRoles('kid', 'parent', 'admin'), validateRequest(kidProgressSchema), upsertKidProgress);
router.get('/rewards/:kidId', protect, authorizeRoles('kid', 'parent', 'admin'), getKidRewards);
router.put('/parent-controls/:kidId', protect, authorizeRoles('parent', 'admin'), validateRequest(parentControlSchema), upsertParentControl);
router.get('/safety-events', protect, authorizeRoles('parent', 'admin'), listKidSafetyEvents);

module.exports = router;
