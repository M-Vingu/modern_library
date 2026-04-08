const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { bookCreateSchema, idParamOnlySchema } = require('../validations/legacySchemas');
const {
  getBooks,
  addBook,
  borrowBook,
  returnBook,
} = require('../controllers/bookController');

// GET all books
router.get('/', getBooks);

// CREATE a book
router.post('/', protect, authorizeRoles('admin'), validateRequest(bookCreateSchema), addBook);

// BORROW a book
router.post('/:id/borrow', protect, validateRequest(idParamOnlySchema), borrowBook);

// RETURN a book
router.post('/:id/return', protect, validateRequest(idParamOnlySchema), returnBook);

module.exports = router;
