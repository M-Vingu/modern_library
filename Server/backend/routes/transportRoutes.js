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
  bookRide,
  deleteRide,
} = require('../controllers/rideController');

// GET all transport rides
router.get('/', getRides);

// CREATE transport ride
router.post('/', protect, authorizeRoles('admin'), validateRequest(rideCreateSchema), createRide);

// BOOK a seat on transport ride (wallet payment)
router.post('/:id/book', protect, validateRequest(idParamOnlySchema), bookRide);

// DELETE transport ride
router.delete('/:id', protect, authorizeRoles('admin'), validateRequest(idParamOnlySchema), deleteRide);

module.exports = router;
