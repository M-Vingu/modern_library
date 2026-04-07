const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getRides,
  createRide,
  bookRide,
  deleteRide,
} = require('../controllers/rideController');

// GET all transport rides
router.get('/', getRides);

// CREATE transport ride
router.post('/', protect, authorizeRoles('admin'), createRide);

// BOOK a seat on transport ride (wallet payment)
router.post('/:id/book', protect, bookRide);

// DELETE transport ride
router.delete('/:id', protect, authorizeRoles('admin'), deleteRide);

module.exports = router;
