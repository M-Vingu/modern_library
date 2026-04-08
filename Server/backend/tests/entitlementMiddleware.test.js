const test = require('node:test');
const assert = require('node:assert/strict');

const { requireFeature } = require('../middleware/entitlementMiddleware');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    fail(status, code, message, details) {
      this.statusCode = status;
      this.body = { success: false, error: { code, message, details } };
      return this;
    },
  };
}

test('entitlement middleware blocks missing feature', async () => {
  const originalSubFind = UserSubscription.findOne;
  const originalPlanFindById = SubscriptionPlan.findById;

  UserSubscription.findOne = () => ({ lean: async () => ({ userId: 'u1', planId: 'p1', status: 'active', endsAt: new Date(Date.now() + 10000) }) });
  SubscriptionPlan.findById = () => ({ lean: async () => ({ _id: 'p1', features: ['basic'] }) });

  const req = { user: { id: 'u1', role: 'student' } };
  const res = mockRes();
  let nextCalled = false;

  await requireFeature('finance_reports')(req, res, () => {
    nextCalled = true;
  });

  UserSubscription.findOne = originalSubFind;
  SubscriptionPlan.findById = originalPlanFindById;

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.error.code, 'ENTITLEMENT_REQUIRED');
});
