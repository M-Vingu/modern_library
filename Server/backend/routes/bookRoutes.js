const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getBooks,
  addBook,
  borrowBook,
  returnBook,
} = require('../controllers/bookController');

// GET all books
router.get('/', getBooks);

// CREATE a book
router.post('/', protect, authorizeRoles('admin'), addBook);

// BORROW a book
router.post('/:id/borrow', protect, borrowBook);

// RETURN a book
router.post('/:id/return', protect, returnBook);

module.exports = router;
