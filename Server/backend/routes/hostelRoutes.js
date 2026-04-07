const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware'); // JWT middleware
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getHostels,
  createHostel,
  bookHostel,
  deleteHostel,
} = require('../controllers/hostelController');

// GET all hostels
router.get('/', getHostels);

// CREATE hostel (admin only, could add role check later)
router.post('/', protect, authorizeRoles('admin'), createHostel);

// BOOK hostel (wallet payment)
router.post('/:id/book', protect, bookHostel);

// DELETE hostel
router.delete('/:id', protect, authorizeRoles('admin'), deleteHostel);

module.exports = router;
