const { z } = require('zod');
const { currency, objectId, passthroughObject } = require('./commonSchemas');

const cabBookingSchema = z.object({
  body: z.object({
    partnerId: z.string().min(8),
    vehicleId: z.string().min(8),
    pickupLocation: z.string().min(2).max(300),
    dropoffLocation: z.string().min(2).max(300),
    scheduledAt: z.string().optional(),
    distanceKm: z.number().nonnegative().optional(),
    estimatedFare: z.number().nonnegative(),
    currency: z.string().max(10).optional(),
    notes: z.string().max(1000).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const partnerStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
    verificationNotes: z.string().max(1000).optional(),
  }),
  params: z.object({ id: z.string().min(8) }),
  query: passthroughObject,
});

const partnerOnboardSchema = z.object({
  body: z.object({
    businessType: z.enum(['cab', 'hotel', 'hostel', 'mixed']),
    businessName: z.string().min(1).max(200),
    registrationNumber: z.string().max(120).optional(),
    contactEmail: z.string().email(),
    contactPhone: z.string().min(5).max(40),
    city: z.string().max(120).optional(),
    address: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const cabVehicleCreateSchema = z.object({
  body: z.object({
    plateNumber: z.string().min(3).max(30),
    vehicleType: z.enum(['sedan', 'van', 'bus', 'motorbike', 'other']).optional(),
    seats: z.coerce.number().int().min(1).optional(),
    driverName: z.string().max(200).optional(),
    driverPhone: z.string().max(40).optional(),
    baseFare: z.coerce.number().min(0).optional(),
    farePerKm: z.coerce.number().min(0).optional(),
    currency: currency.optional(),
    status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  }),
  params: z.object({ partnerId: objectId }),
  query: passthroughObject,
});

const cabBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(['accepted', 'ongoing', 'completed', 'cancelled', 'rejected']),
    finalFare: z.coerce.number().min(0).optional(),
  }),
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

const accommodationCreateSchema = z.object({
  body: z.object({
    listingType: z.enum(['hotel', 'hostel']),
    name: z.string().min(1).max(200),
    location: z.string().min(1).max(300),
    roomType: z.string().max(120).optional(),
    capacity: z.coerce.number().int().min(1).optional(),
    availableUnits: z.coerce.number().int().min(0).optional(),
    pricePerNight: z.coerce.number().min(0),
    currency: currency.optional(),
    amenities: z.array(z.string().max(120)).optional(),
    imageUrls: z.array(z.string().url()).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
  params: z.object({ partnerId: objectId }),
  query: passthroughObject,
});

const accommodationApplySchema = z.object({
  body: z.object({
    checkInDate: z.string().min(1),
    checkOutDate: z.string().min(1),
    occupants: z.coerce.number().int().min(1).optional(),
    notes: z.string().max(2000).optional(),
  }),
  params: z.object({ listingId: objectId }),
  query: passthroughObject,
});

const accommodationStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    reviewNotes: z.string().max(2000).optional(),
  }),
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

module.exports = {
  cabBookingSchema,
  partnerStatusSchema,
  partnerOnboardSchema,
  cabVehicleCreateSchema,
  cabBookingStatusSchema,
  accommodationCreateSchema,
  accommodationApplySchema,
  accommodationStatusSchema,
};
