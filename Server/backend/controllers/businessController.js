const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const MarketplaceDispute = require('../models/MarketplaceDispute');
const MarketplaceListing = require('../models/MarketplaceListing');
const UserReputation = require('../models/UserReputation');
const SettlementLedger = require('../models/SettlementLedger');
const { writeAuditLog } = require('../services/auditLogService');

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

async function createPlan(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'ENTITLEMENT_FORBIDDEN', 'Admin only');
  try {
    const item = await SubscriptionPlan.create(req.body);
    return res.status(201).json({ success: true, item });
  } catch (err) {
    return fail(res, 400, 'ENTITLEMENT_PLAN_CREATE_FAILED', err.message);
  }
}

async function subscribeToPlan(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.body.planId)) return fail(res, 400, 'ENTITLEMENT_PLAN_INVALID', 'Invalid planId');
  const plan = await SubscriptionPlan.findById(req.body.planId);
  if (!plan || !plan.isActive) return fail(res, 404, 'ENTITLEMENT_PLAN_NOT_FOUND', 'Plan not found');

  const endsAt = new Date();
  endsAt.setMonth(endsAt.getMonth() + (plan.billingCycle === 'yearly' ? 12 : 1));

  const item = await UserSubscription.findOneAndUpdate(
    { userId: req.user.id, status: 'active' },
    {
      $set: {
        userId: req.user.id,
        planId: plan._id,
        status: 'active',
        startsAt: new Date(),
        endsAt,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  return res.status(201).json({ success: true, item });
}

async function listMySubscription(req, res) {
  const items = await UserSubscription.find({ userId: req.user.id }).populate('planId').sort({ createdAt: -1 });
  return res.json({ success: true, items });
}

async function openDispute(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.listingId)) return fail(res, 400, 'DISPUTE_LISTING_INVALID', 'Invalid listing id');
  const listing = await MarketplaceListing.findById(req.params.listingId);
  if (!listing) return fail(res, 404, 'DISPUTE_LISTING_NOT_FOUND', 'Listing not found');

  const againstUserId = listing.sellerId.toString() === req.user.id ? listing.buyerId : listing.sellerId;
  if (!againstUserId) return fail(res, 400, 'DISPUTE_TARGET_MISSING', 'No counterparty found for dispute');

  const item = await MarketplaceDispute.create({
    listingId: listing._id,
    openedByUserId: req.user.id,
    againstUserId,
    reason: req.body.reason,
    status: 'open',
  });

  await UserReputation.findOneAndUpdate(
    { userId: againstUserId },
    { $inc: { disputesOpenedAgainst: 1 }, $setOnInsert: { userId: againstUserId } },
    { upsert: true },
  );

  await writeAuditLog(req, {
    action: 'marketplace.dispute_opened',
    targetType: 'marketplace_dispute',
    targetId: item._id,
    metadata: { listingId: listing._id.toString() },
  });

  return res.status(201).json({ success: true, item });
}

async function respondDispute(req, res) {
  const item = await MarketplaceDispute.findById(req.params.id);
  if (!item) return fail(res, 404, 'DISPUTE_NOT_FOUND', 'Dispute not found');
  if (item.againstUserId.toString() !== req.user.id && req.user.role !== 'admin') {
    return fail(res, 403, 'DISPUTE_FORBIDDEN', 'Forbidden dispute access');
  }
  if (item.status !== 'open') return fail(res, 409, 'DISPUTE_STATE_INVALID', 'Dispute not open');

  item.response = req.body.response;
  item.status = 'responded';
  await item.save();
  return res.json({ success: true, item });
}

async function resolveDispute(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'DISPUTE_FORBIDDEN', 'Admin only');
  const item = await MarketplaceDispute.findById(req.params.id);
  if (!item) return fail(res, 404, 'DISPUTE_NOT_FOUND', 'Dispute not found');
  if (!['open', 'responded'].includes(item.status)) return fail(res, 409, 'DISPUTE_STATE_INVALID', 'Dispute cannot be resolved in current state');

  item.resolution = req.body.resolution;
  item.status = 'resolved';
  item.resolvedBy = req.user.id;
  item.resolvedAt = new Date();
  await item.save();

  if (String(req.body.winner || '').toLowerCase() === 'opener') {
    const rep = await UserReputation.findOneAndUpdate(
      { userId: item.againstUserId },
      {
        $inc: { disputesLost: 1 },
        $setOnInsert: { userId: item.againstUserId, sellerScore: 5 },
      },
      { upsert: true, returnDocument: 'after' },
    );
    rep.sellerScore = Math.max(0, Number((Number(rep.sellerScore || 5) - 0.2).toFixed(2)));
    await rep.save();
  }

  return res.json({ success: true, item });
}

async function financeSummary(req, res) {
  if (req.user.role !== 'admin') return fail(res, 403, 'FINANCE_FORBIDDEN', 'Admin only');
  const [pending, processing, paid] = await Promise.all([
    SettlementLedger.aggregate([{ $match: { status: 'pending' } }, { $group: { _id: null, gross: { $sum: '$grossAmount' }, payout: { $sum: '$partnerPayout' }, commission: { $sum: '$commissionAmount' } } }]),
    SettlementLedger.aggregate([{ $match: { status: 'processing' } }, { $group: { _id: null, gross: { $sum: '$grossAmount' }, payout: { $sum: '$partnerPayout' }, commission: { $sum: '$commissionAmount' } } }]),
    SettlementLedger.aggregate([{ $match: { status: { $in: ['paid', 'settled'] } } }, { $group: { _id: null, gross: { $sum: '$grossAmount' }, payout: { $sum: '$partnerPayout' }, commission: { $sum: '$commissionAmount' } } }]),
  ]);

  return res.json({
    success: true,
    pending: pending[0] || { gross: 0, payout: 0, commission: 0 },
    processing: processing[0] || { gross: 0, payout: 0, commission: 0 },
    paid: paid[0] || { gross: 0, payout: 0, commission: 0 },
  });
}

module.exports = {
  createPlan,
  subscribeToPlan,
  listMySubscription,
  openDispute,
  respondDispute,
  resolveDispute,
  financeSummary,
};
