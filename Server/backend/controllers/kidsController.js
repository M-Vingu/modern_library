const mongoose = require('mongoose');
const KidProfile = require('../models/KidProfile');
const KidContent = require('../models/KidContent');
const KidProgress = require('../models/KidProgress');
const KidReward = require('../models/KidReward');
const ParentControl = require('../models/ParentControl');
const KidSafetyEvent = require('../models/KidSafetyEvent');

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

function parseAgeBand(ageBand) {
  const [min, max] = String(ageBand || '').split('-').map((v) => Number(v));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

async function ensureParentOwnsKid(req, kidId) {
  const kid = await KidProfile.findById(kidId);
  if (!kid) return { ok: false, status: 404, code: 'KID_NOT_FOUND', message: 'Kid profile not found' };
  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && kid.parentUserId.toString() !== req.user.id) {
    return { ok: false, status: 403, code: 'KID_FORBIDDEN', message: 'Forbidden kid access' };
  }
  return { ok: true, kid };
}

async function createKidProfile(req, res) {
  try {
    const { userId, displayName, birthYear, ageBand, language, avatarUrl } = req.body;
    const kid = await KidProfile.create({
      userId,
      parentUserId: req.user.id,
      displayName,
      birthYear,
      ageBand,
      language,
      avatarUrl,
    });
    await KidReward.findOneAndUpdate(
      { kidId: kid._id },
      { $setOnInsert: { kidId: kid._id, points: 0 } },
      { upsert: true },
    );
    await ParentControl.findOneAndUpdate(
      { parentUserId: req.user.id, kidId: kid._id },
      { $setOnInsert: { parentUserId: req.user.id, kidId: kid._id } },
      { upsert: true },
    );
    return res.status(201).json({ success: true, item: kid });
  } catch (err) {
    return fail(res, 400, 'KID_CREATE_FAILED', err.message);
  }
}

async function listKidProfiles(req, res) {
  const filter = req.user.role === 'admin' ? {} : { parentUserId: req.user.id };
  const items = await KidProfile.find(filter).sort({ createdAt: -1 });
  return res.json({ success: true, items });
}

async function listKidContent(req, res) {
  try {
    const { kidId, topic } = req.query;
    if (!kidId || !mongoose.Types.ObjectId.isValid(kidId)) {
      return fail(res, 400, 'KID_CONTENT_KID_ID_REQUIRED', 'kidId query parameter is required');
    }

    const ownership = await ensureParentOwnsKid(req, kidId);
    if (!ownership.ok && req.user.role !== 'kid') {
      return fail(res, ownership.status, ownership.code, ownership.message);
    }

    let kid = ownership.kid;
    if (req.user.role === 'kid') {
      kid = await KidProfile.findOne({ userId: req.user.id });
      if (!kid) return fail(res, 404, 'KID_PROFILE_NOT_FOUND', 'Kid profile not found for account');
      if (kid._id.toString() !== String(kidId)) return fail(res, 403, 'KID_FORBIDDEN', 'Forbidden kid access');
    }

    const age = parseAgeBand(kid.ageBand);
    if (!age) return fail(res, 400, 'KID_AGE_BAND_INVALID', 'Invalid age band configuration');

    const control = await ParentControl.findOne({ kidId: kid._id, parentUserId: kid.parentUserId });
    const blocked = new Set((control?.blockedTopics || []).map((v) => String(v).toLowerCase()));

    const filter = {
      isPublished: true,
      safetyRating: { $ne: 'red' },
      ageBandMin: { $lte: age.max },
      ageBandMax: { $gte: age.min },
    };
    if (topic) filter.topics = topic;

    let items = await KidContent.find(filter).sort({ createdAt: -1 });
    items = items.filter((item) => {
      const topics = (item.topics || []).map((t) => String(t).toLowerCase());
      return !topics.some((t) => blocked.has(t));
    });

    return res.json({ success: true, items });
  } catch (err) {
    return fail(res, 500, 'KID_CONTENT_LIST_FAILED', err.message);
  }
}

async function upsertKidProgress(req, res) {
  try {
    const { kidId, contentId, completionPct, score, timeSpentSec, attempts } = req.body;

    if (req.user.role === 'kid') {
      const kid = await KidProfile.findOne({ userId: req.user.id });
      if (!kid || kid._id.toString() !== String(kidId)) {
        return fail(res, 403, 'KID_FORBIDDEN', 'Kid can only update own progress');
      }
    } else {
      const ownership = await ensureParentOwnsKid(req, kidId);
      if (!ownership.ok) return fail(res, ownership.status, ownership.code, ownership.message);
    }

    const item = await KidProgress.findOneAndUpdate(
      { kidId, contentId },
      {
        $set: {
          completionPct,
          score,
          timeSpentSec,
          attempts,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return res.status(201).json({ success: true, item });
  } catch (err) {
    return fail(res, 400, 'KID_PROGRESS_UPSERT_FAILED', err.message);
  }
}

async function getKidRewards(req, res) {
  const { kidId } = req.params;
  const ownership = await ensureParentOwnsKid(req, kidId);
  if (!ownership.ok && req.user.role !== 'kid') {
    return fail(res, ownership.status, ownership.code, ownership.message);
  }

  if (req.user.role === 'kid') {
    const ownKid = await KidProfile.findOne({ userId: req.user.id });
    if (!ownKid || ownKid._id.toString() !== String(kidId)) return fail(res, 403, 'KID_FORBIDDEN', 'Forbidden');
  }

  const item = await KidReward.findOne({ kidId });
  if (!item) return fail(res, 404, 'KID_REWARD_NOT_FOUND', 'Kid reward profile not found');
  return res.json({ success: true, item });
}

async function upsertParentControl(req, res) {
  const { kidId } = req.params;
  const ownership = await ensureParentOwnsKid(req, kidId);
  if (!ownership.ok) return fail(res, ownership.status, ownership.code, ownership.message);

  const { dailyScreenLimitMin, allowedTopics, blockedTopics, interactionMode, purchasePinEnabled } = req.body;
  const item = await ParentControl.findOneAndUpdate(
    { parentUserId: req.user.id, kidId },
    {
      $set: {
        dailyScreenLimitMin,
        allowedTopics: Array.isArray(allowedTopics) ? allowedTopics : undefined,
        blockedTopics: Array.isArray(blockedTopics) ? blockedTopics : undefined,
        interactionMode,
        purchasePinEnabled,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  return res.json({ success: true, item });
}

async function listKidSafetyEvents(req, res) {
  const { kidId, status } = req.query;
  const filter = {};
  if (kidId) filter.kidId = kidId;
  if (status) filter.reviewStatus = status;

  if (req.user.role !== 'admin') {
    const myKids = await KidProfile.find({ parentUserId: req.user.id }).select('_id');
    filter.kidId = { $in: myKids.map((k) => k._id) };
  }

  const items = await KidSafetyEvent.find(filter).sort({ createdAt: -1 }).limit(200);
  return res.json({ success: true, items });
}

module.exports = {
  createKidProfile,
  listKidProfiles,
  listKidContent,
  upsertKidProgress,
  getKidRewards,
  upsertParentControl,
  listKidSafetyEvents,
};
