// routes/walletRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { getWallet, addFunds, deductFunds } = require('../controllers/walletController');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');
const { walletMutationSchema } = require('../validations/walletSchemas');
const { idempotencyMiddleware } = require('../middleware/idempotency');

const walletMutationLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 40,
  keyPrefix: 'wallet-mutation',
});

// GET wallet balance
router.get('/', protect, getWallet);

// DEPOSIT funds
router.post('/deposit', protect, walletMutationLimiter, validateRequest(walletMutationSchema), idempotencyMiddleware(), addFunds);

// PAY funds
router.post('/pay', protect, walletMutationLimiter, validateRequest(walletMutationSchema), idempotencyMiddleware(), deductFunds);

module.exports = router;
