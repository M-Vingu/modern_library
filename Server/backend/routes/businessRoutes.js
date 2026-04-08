const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { requireFeature } = require('../middleware/entitlementMiddleware');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const {
  createPlan,
  subscribeToPlan,
  listMySubscription,
  openDispute,
  respondDispute,
  resolveDispute,
  financeSummary,
} = require('../controllers/businessController');
const {
  createPlanSchema,
  subscribeSchema,
  openDisputeSchema,
  respondDisputeSchema,
  resolveDisputeSchema,
} = require('../validations/businessSchemas');

router.post('/plans', protect, validateRequest(createPlanSchema), createPlan);
router.post('/subscriptions', protect, validateRequest(subscribeSchema), idempotencyMiddleware(), subscribeToPlan);
router.get('/subscriptions/my', protect, listMySubscription);
router.post('/marketplace/disputes/:listingId/open', protect, validateRequest(openDisputeSchema), idempotencyMiddleware(), openDispute);
router.post('/marketplace/disputes/:id/respond', protect, validateRequest(respondDisputeSchema), respondDispute);
router.post('/marketplace/disputes/:id/resolve', protect, validateRequest(resolveDisputeSchema), idempotencyMiddleware(), resolveDispute);
router.get('/finance/summary', protect, requireFeature('finance_reports'), financeSummary);

module.exports = router;
