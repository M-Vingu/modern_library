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

router.get('/', listListings);
router.get('/my/listings', protect, listMyListings);
router.get('/:id', getListingById);
router.post('/', protect, createListing);
router.patch('/:id', protect, updateMyListing);
router.post('/:id/buy', protect, buyListing);

module.exports = router;
