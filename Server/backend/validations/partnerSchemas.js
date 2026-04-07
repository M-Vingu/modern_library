const { z } = require('zod');

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
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const partnerStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
    verificationNotes: z.string().max(1000).optional(),
  }),
  params: z.object({
    id: z.string().min(8),
  }),
  query: z.object({}).passthrough(),
});

module.exports = { cabBookingSchema, partnerStatusSchema };
