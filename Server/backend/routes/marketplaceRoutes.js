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
const { marketplaceUpdateSchema, idParamOnlySchema } = require('../validations/legacySchemas');
const { idempotencyMiddleware } = require('../middleware/idempotency');

router.get('/', listListings);
router.get('/my/listings', protect, listMyListings);
router.get('/:id', getListingById);
router.post('/', protect, validateRequest(createListingSchema), createListing);
router.patch('/:id', protect, validateRequest(marketplaceUpdateSchema), updateMyListing);
router.post('/:id/buy', protect, validateRequest(idParamOnlySchema), idempotencyMiddleware(), buyListing);

module.exports = router;
