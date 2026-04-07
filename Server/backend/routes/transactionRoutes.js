const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getUserTransactions,
  getTransactionById,
  getAllTransactions,
} = require('../controllers/transactionController');

// GET logged-in user's transactions
router.get('/my', protect, getUserTransactions);

// GET single transaction owned by logged-in user
router.get('/:id', protect, getTransactionById);

// GET all transactions (consider admin-only authorization in future)
router.get('/', protect, authorizeRoles('admin'), getAllTransactions);

module.exports = router;
