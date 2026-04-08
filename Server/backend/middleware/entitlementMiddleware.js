const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');

function requireFeature(featureCode) {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();

    const activeSub = await UserSubscription.findOne({
      userId: req.user.id,
      status: 'active',
      endsAt: { $gt: new Date() },
    }).lean();

    if (!activeSub) {
      if (typeof res.fail === 'function') return res.fail(402, 'ENTITLEMENT_REQUIRED', 'Premium entitlement required', { feature: featureCode });
      return res.status(402).json({ message: 'Premium entitlement required', feature: featureCode });
    }

    const plan = await SubscriptionPlan.findById(activeSub.planId).lean();
    if (!plan || !Array.isArray(plan.features) || !plan.features.includes(featureCode)) {
      if (typeof res.fail === 'function') return res.fail(402, 'ENTITLEMENT_REQUIRED', 'Feature not included in active plan', { feature: featureCode });
      return res.status(402).json({ message: 'Feature not included in active plan', feature: featureCode });
    }

    return next();
  };
}

module.exports = { requireFeature };
