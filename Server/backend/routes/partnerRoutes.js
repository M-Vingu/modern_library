const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { cabBookingSchema, partnerStatusSchema } = require('../validations/partnerSchemas');
const { idempotencyMiddleware } = require('../middleware/idempotency');
const {
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
} = require('../controllers/partnerController');

// Partner onboarding + verification flow
router.post('/onboard', protect, createPartnerOnboarding);
router.get('/my', protect, listMyPartners);
router.get('/pending', protect, authorizeRoles('admin'), listPendingPartners);
router.patch('/:id/status', protect, authorizeRoles('admin'), validateRequest(partnerStatusSchema), updatePartnerStatus);

// Cab fleet + booking flow
router.post('/:partnerId/cabs', protect, createCabVehicle);
router.get('/:partnerId/cabs', listPartnerCabVehicles);
router.post('/cab-bookings', protect, validateRequest(cabBookingSchema), idempotencyMiddleware(), createCabBooking);
router.get('/cab-bookings/my', protect, listMyCabBookings);
router.patch('/cab-bookings/:id/status', protect, idempotencyMiddleware(), updateCabBookingStatus);

// Hotel/hostel partner listing + application flow
router.post('/:partnerId/accommodations', protect, createAccommodationListing);
router.get('/accommodations', listAccommodationListings);
router.post('/accommodations/:listingId/apply', protect, applyForAccommodation);
router.get('/accommodation-applications/my', protect, listMyAccommodationApplications);
router.patch('/accommodation-applications/:id/status', protect, idempotencyMiddleware(), updateAccommodationApplicationStatus);

// Settlement ledger (partner and admin views)
router.get('/settlements/my', protect, listMySettlementLedger);
router.get('/settlements', protect, authorizeRoles('admin'), listAllSettlementLedger);

module.exports = router;
