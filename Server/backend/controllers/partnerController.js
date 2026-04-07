const mongoose = require('mongoose');
const Partner = require('../models/Partner');
const CabVehicle = require('../models/CabVehicle');
const CabBooking = require('../models/CabBooking');
const AccommodationListing = require('../models/AccommodationListing');
const AccommodationApplication = require('../models/AccommodationApplication');
const SettlementLedger = require('../models/SettlementLedger');
const { writeAuditLog } = require('../services/auditLogService');
const { enqueueSettlementGeneration, enqueueNotification } = require('../services/jobDispatchService');

function isAdmin(req) {
  return req.user?.role === 'admin';
}

function partnerCommissionPercent() {
  const raw = Number(process.env.PARTNER_COMMISSION_PERCENT || 10);
  if (!Number.isFinite(raw) || raw < 0) return 10;
  return Math.min(raw, 50);
}

async function createSettlementEntry({
  bookingType,
  bookingRefId,
  partnerId,
  userId,
  grossAmount,
  currency,
  notes,
}) {
  const commissionPercent = partnerCommissionPercent();
  const commissionAmount = Number((grossAmount * commissionPercent / 100).toFixed(2));
  const partnerPayout = Number((grossAmount - commissionAmount).toFixed(2));

  const entry = await SettlementLedger.findOneAndUpdate(
    { bookingType, bookingRefId },
    {
      $setOnInsert: {
        partnerId,
        bookingType,
        bookingRefId,
        userId,
        grossAmount,
        commissionPercent,
        commissionAmount,
        partnerPayout,
        currency: currency || 'KES',
        status: 'pending',
        notes,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  await enqueueSettlementGeneration({
    settlementId: entry._id.toString(),
    bookingType,
    bookingRefId: String(bookingRefId),
    partnerId: String(partnerId),
    userId: String(userId),
  });
  return entry;
}

async function createPartnerOnboarding(req, res) {
  try {
    const {
      businessType,
      businessName,
      registrationNumber,
      contactEmail,
      contactPhone,
      city,
      address,
      description,
    } = req.body;

    if (!businessType || !businessName || !contactEmail || !contactPhone) {
      return res.status(400).json({ message: 'Missing required partner fields' });
    }

    const partner = await Partner.create({
      ownerUserId: req.user.id,
      businessType,
      businessName,
      registrationNumber,
      contactEmail,
      contactPhone,
      city,
      address,
      description,
      verificationStatus: 'pending',
    });

    res.status(201).json(partner);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listMyPartners(req, res) {
  try {
    const items = await Partner.find({ ownerUserId: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listPendingPartners(req, res) {
  try {
    const items = await Partner.find({ verificationStatus: 'pending' }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updatePartnerStatus(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid partner id' });
    }
    const { status, verificationNotes } = req.body;
    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const item = await Partner.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: status, verificationNotes },
      { returnDocument: 'after' },
    );
    if (!item) return res.status(404).json({ message: 'Partner not found' });

    await writeAuditLog(req, {
      action: 'partner.status.updated',
      targetType: 'partner',
      targetId: item._id,
      metadata: { status, verificationNotes },
    });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCabVehicle(req, res) {
  try {
    const { partnerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ message: 'Invalid partner id' });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) return res.status(404).json({ message: 'Partner not found' });

    const ownsPartner = partner.ownerUserId.toString() === req.user.id;
    if (!isAdmin(req) && !ownsPartner) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (partner.verificationStatus !== 'approved') {
      return res.status(400).json({ message: 'Partner must be approved before adding vehicles' });
    }

    const vehicle = await CabVehicle.create({
      partnerId,
      ...req.body,
    });
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPartnerCabVehicles(req, res) {
  try {
    const { partnerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ message: 'Invalid partner id' });
    }
    const items = await CabVehicle.find({ partnerId, status: 'active' }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCabBooking(req, res) {
  try {
    const {
      partnerId,
      vehicleId,
      pickupLocation,
      dropoffLocation,
      scheduledAt,
      distanceKm,
      estimatedFare,
      currency,
      notes,
    } = req.body;

    if (!partnerId || !vehicleId || !pickupLocation || !dropoffLocation || estimatedFare === undefined) {
      return res.status(400).json({ message: 'Missing required cab booking fields' });
    }
    if (!mongoose.Types.ObjectId.isValid(partnerId) || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({ message: 'Invalid partnerId or vehicleId' });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner || partner.verificationStatus !== 'approved') {
      return res.status(400).json({ message: 'Partner not available for bookings' });
    }

    const vehicle = await CabVehicle.findOne({ _id: vehicleId, partnerId, status: 'active' });
    if (!vehicle) return res.status(404).json({ message: 'Cab vehicle not found or inactive' });

    const booking = await CabBooking.create({
      userId: req.user.id,
      partnerId,
      vehicleId,
      pickupLocation,
      dropoffLocation,
      scheduledAt,
      distanceKm,
      estimatedFare: Number(estimatedFare),
      currency: currency || 'KES',
      notes,
      status: 'requested',
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listMyCabBookings(req, res) {
  try {
    const items = await CabBooking.find({ userId: req.user.id })
      .populate('vehicleId', 'plateNumber vehicleType driverName driverPhone')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateCabBookingStatus(req, res) {
  const dbSession = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid cab booking id' });
    }
    const { status, finalFare } = req.body;
    if (!['accepted', 'ongoing', 'completed', 'cancelled', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await CabBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (!isAdmin(req)) {
      const ownerPartners = await Partner.find({ ownerUserId: req.user.id }).select('_id');
      const ownerPartnerIds = ownerPartners.map((p) => p._id.toString());
      const ownsBooking = ownerPartnerIds.includes(booking.partnerId.toString());
      if (!ownsBooking) return res.status(403).json({ message: 'Forbidden' });
    }

    await dbSession.withTransaction(async () => {
      booking.status = status;
      if (finalFare !== undefined) booking.finalFare = Number(finalFare);
      await booking.save({ session: dbSession });

      if (status === 'completed') {
        const grossAmount = Number(booking.finalFare ?? booking.estimatedFare);
        if (Number.isFinite(grossAmount) && grossAmount >= 0) {
          await createSettlementEntry({
            bookingType: 'cab',
            bookingRefId: booking._id,
            partnerId: booking.partnerId,
            userId: booking.userId,
            grossAmount,
            currency: booking.currency || 'KES',
            notes: 'Auto-created from completed cab booking',
          });
        }
      }
    });

    if (status === 'completed') {
      await writeAuditLog(req, {
        action: 'partner.cab_booking.completed',
        targetType: 'cab_booking',
        targetId: booking._id,
        metadata: { finalFare: booking.finalFare, estimatedFare: booking.estimatedFare },
      });
      await enqueueNotification({
        userId: String(booking.userId),
        channel: 'in_app',
        template: 'cab_booking_completed',
        data: { bookingId: String(booking._id) },
      });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    dbSession.endSession();
  }
}

async function createAccommodationListing(req, res) {
  try {
    const { partnerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ message: 'Invalid partner id' });
    }

    const partner = await Partner.findById(partnerId);
    if (!partner) return res.status(404).json({ message: 'Partner not found' });

    const ownsPartner = partner.ownerUserId.toString() === req.user.id;
    if (!isAdmin(req) && !ownsPartner) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (partner.verificationStatus !== 'approved') {
      return res.status(400).json({ message: 'Partner must be approved before adding listings' });
    }

    const item = await AccommodationListing.create({
      partnerId,
      ...req.body,
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listAccommodationListings(req, res) {
  try {
    const { q, listingType, location, page = 1, limit = 20 } = req.query;
    const filter = { status: 'active' };
    if (listingType) filter.listingType = listingType;
    if (location) filter.location = new RegExp(location, 'i');
    if (q) filter.name = new RegExp(q, 'i');

    const safeLimit = Math.min(Number(limit) || 20, 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const items = await AccommodationListing.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('partnerId', 'businessName city verificationStatus');

    const total = await AccommodationListing.countDocuments(filter);
    res.json({ page: safePage, limit: safeLimit, total, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function applyForAccommodation(req, res) {
  try {
    const { listingId } = req.params;
    const { checkInDate, checkOutDate, occupants, notes } = req.body;
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: 'Invalid listing id' });
    }
    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ message: 'checkInDate and checkOutDate are required' });
    }

    const listing = await AccommodationListing.findById(listingId);
    if (!listing || listing.status !== 'active') {
      return res.status(404).json({ message: 'Accommodation listing not found' });
    }
    if (listing.availableUnits <= 0) {
      return res.status(400).json({ message: 'No available units' });
    }

    const app = await AccommodationApplication.create({
      userId: req.user.id,
      partnerId: listing.partnerId,
      listingId,
      checkInDate,
      checkOutDate,
      occupants: Math.max(Number(occupants) || 1, 1),
      notes,
      status: 'pending',
    });

    res.status(201).json(app);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listMyAccommodationApplications(req, res) {
  try {
    const items = await AccommodationApplication.find({ userId: req.user.id })
      .populate('listingId', 'name location pricePerNight listingType')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateAccommodationApplicationStatus(req, res) {
  const dbSession = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid application id' });
    }
    const { status, reviewNotes } = req.body;
    if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const app = await AccommodationApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    if (!isAdmin(req)) {
      const ownerPartners = await Partner.find({ ownerUserId: req.user.id }).select('_id');
      const ownerPartnerIds = ownerPartners.map((p) => p._id.toString());
      if (!ownerPartnerIds.includes(app.partnerId.toString())) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    await dbSession.withTransaction(async () => {
      app.status = status;
      app.reviewNotes = reviewNotes;
      await app.save({ session: dbSession });

      // Reduce inventory once approved (basic scaffold behavior).
      if (status === 'approved') {
        await AccommodationListing.findOneAndUpdate(
          { _id: app.listingId, availableUnits: { $gt: 0 } },
          { $inc: { availableUnits: -1 } },
          { session: dbSession },
        );

        const listing = await AccommodationListing.findById(app.listingId).session(dbSession);
        if (listing) {
          const msDay = 24 * 60 * 60 * 1000;
          const nights = Math.max(
            1,
            Math.ceil((new Date(app.checkOutDate).getTime() - new Date(app.checkInDate).getTime()) / msDay),
          );
          const grossAmount = Number((nights * Number(listing.pricePerNight || 0)).toFixed(2));

          await createSettlementEntry({
            bookingType: 'accommodation',
            bookingRefId: app._id,
            partnerId: app.partnerId,
            userId: app.userId,
            grossAmount,
            currency: listing.currency || 'KES',
            notes: `Auto-created from approved accommodation application (${nights} night(s))`,
          });
        }
      }
    });

    if (status === 'approved') {
      await writeAuditLog(req, {
        action: 'partner.accommodation_application.approved',
        targetType: 'accommodation_application',
        targetId: app._id,
        metadata: { reviewNotes },
      });
      await enqueueNotification({
        userId: String(app.userId),
        channel: 'in_app',
        template: 'accommodation_application_approved',
        data: { applicationId: String(app._id) },
      });
    }

    res.json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    dbSession.endSession();
  }
}

async function listMySettlementLedger(req, res) {
  try {
    const ownerPartners = await Partner.find({ ownerUserId: req.user.id }).select('_id');
    const ownerPartnerIds = ownerPartners.map((p) => p._id);
    const items = await SettlementLedger.find({ partnerId: { $in: ownerPartnerIds } })
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listAllSettlementLedger(req, res) {
  try {
    const items = await SettlementLedger.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createPartnerOnboarding,
  listMyPartners,
  listPendingPartners,
  updatePartnerStatus,
  createCabVehicle,
  listPartnerCabVehicles,
  createCabBooking,
  listMyCabBookings,
  updateCabBookingStatus,
  createAccommodationListing,
  listAccommodationListings,
  applyForAccommodation,
  listMyAccommodationApplications,
  updateAccommodationApplicationStatus,
  listMySettlementLedger,
  listAllSettlementLedger,
};
