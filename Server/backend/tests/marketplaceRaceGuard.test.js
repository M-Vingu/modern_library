const test = require('node:test');
const assert = require('node:assert/strict');

const mongoose = require('mongoose');
const MarketplaceListing = require('../models/MarketplaceListing');
const { buyListing } = require('../controllers/marketplaceController');
const { createMockRes } = require('./testUtils');

test('buyListing rejects non-active listings (availability/race guard)', async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindById = MarketplaceListing.findById;

  mongoose.startSession = async () => ({
    withTransaction: async (fn) => fn(),
    endSession: () => {},
  });

  MarketplaceListing.findById = () => ({
    session: async () => ({
      _id: '507f1f77bcf86cd799439011',
      status: 'sold',
      sellerId: '507f1f77bcf86cd799439099',
      price: 100,
      title: 'Old Book',
    }),
  });

  const req = {
    params: { id: '507f1f77bcf86cd799439011' },
    user: { id: '507f1f77bcf86cd799439012' },
  };
  const res = createMockRes();

  await buyListing(req, res);

  mongoose.startSession = originalStartSession;
  MarketplaceListing.findById = originalFindById;

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Listing is not available');
});
