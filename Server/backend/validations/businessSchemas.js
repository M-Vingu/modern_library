const { z } = require('zod');

const createPlanSchema = z.object({
  body: z.object({
    code: z.string().min(2).max(40),
    name: z.string().min(2).max(120),
    price: z.number().min(0),
    currency: z.enum(['KES', 'USD', 'EUR', 'GBP']).optional(),
    billingCycle: z.enum(['monthly', 'yearly']).optional(),
    features: z.array(z.string().min(1)).default([]),
    isActive: z.boolean().optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const subscribeSchema = z.object({
  body: z.object({ planId: z.string().min(8) }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const openDisputeSchema = z.object({
  body: z.object({ reason: z.string().min(3).max(2000) }),
  params: z.object({ listingId: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

const respondDisputeSchema = z.object({
  body: z.object({ response: z.string().min(3).max(2000) }),
  params: z.object({ id: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

const resolveDisputeSchema = z.object({
  body: z.object({
    resolution: z.string().min(3).max(3000),
    winner: z.enum(['opener', 'counterparty', 'split']).optional(),
  }),
  params: z.object({ id: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

module.exports = {
  createPlanSchema,
  subscribeSchema,
  openDisputeSchema,
  respondDisputeSchema,
  resolveDisputeSchema,
};
