const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const {
  createListing,
  listListings,
  getListingById,
  listMyListings,
  updateMyListing,
  buyListing,
} = require('../controllers/marketplaceController');
const { validateRequest } = require('../middleware/validateRequest');
const { createListingSchema } = require('../validations/marketplaceSchemas');
const { idempotencyMiddleware } = require('../middleware/idempotency');

router.get('/', listListings);
router.get('/my/listings', protect, listMyListings);
router.get('/:id', getListingById);
router.post('/', protect, validateRequest(createListingSchema), createListing);
router.patch('/:id', protect, updateMyListing);
router.post('/:id/buy', protect, idempotencyMiddleware(), buyListing);

module.exports = router;
