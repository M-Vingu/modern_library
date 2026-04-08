const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware'); // JWT middleware
const { validateRequest } = require('../middleware/validateRequest');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { hostelCreateSchema, idParamOnlySchema } = require('../validations/legacySchemas');
const {
  getHostels,
  createHostel,
  bookHostel,
  deleteHostel,
} = require('../controllers/hostelController');

// GET all hostels
router.get('/', getHostels);

// CREATE hostel (admin only, could add role check later)
router.post('/', protect, authorizeRoles('admin'), validateRequest(hostelCreateSchema), createHostel);

// BOOK hostel (wallet payment)
router.post('/:id/book', protect, validateRequest(idParamOnlySchema), bookHostel);

// DELETE hostel
router.delete('/:id', protect, authorizeRoles('admin'), validateRequest(idParamOnlySchema), deleteHostel);

module.exports = router;
