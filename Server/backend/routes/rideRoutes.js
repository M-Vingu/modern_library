const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { idParamOnlySchema } = require('../validations/commonSchemas');
const { rideCreateSchema } = require('../validations/rideSchemas');
const {
  getRides,
  createRide,
  deleteRide,
} = require('../controllers/rideController');

// GET all rides
router.get('/', getRides);

// CREATE ride (admin)
router.post('/', protect, authorizeRoles('admin'), validateRequest(rideCreateSchema), createRide);

// DELETE ride
router.delete('/:id', protect, authorizeRoles('admin'), validateRequest(idParamOnlySchema), deleteRide);

module.exports = router;
