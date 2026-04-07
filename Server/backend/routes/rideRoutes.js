const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getRides,
  createRide,
  deleteRide,
} = require('../controllers/rideController');

// GET all rides
router.get('/', getRides);

// CREATE ride (admin)
router.post('/', protect, authorizeRoles('admin'), createRide);

// DELETE ride
router.delete('/:id', protect, authorizeRoles('admin'), deleteRide);

module.exports = router;
