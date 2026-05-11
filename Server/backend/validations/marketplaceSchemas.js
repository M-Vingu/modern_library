const { z } = require('zod');
const { currency, objectId, passthroughObject } = require('./commonSchemas');

const createListingSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    category: z.string().max(80).optional(),
    condition: z.string().max(80).optional(),
    price: z.number().positive(),
    currency: z.string().max(10).optional(),
    imageUrls: z.array(z.string().url()).optional(),
    quantity: z.number().int().positive().max(10000).optional(),
    tags: z.array(z.string().max(60)).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const marketplaceUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(4000).optional(),
    category: z.string().max(120).optional(),
    condition: z.string().max(100).optional(),
    price: z.coerce.number().min(0).optional(),
    currency: currency.optional(),
    imageUrls: z.array(z.string().url()).optional(),
    status: z.enum(['active', 'reserved', 'sold', 'inactive']).optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    tags: z.array(z.string().max(80)).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one update field is required'),
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

module.exports = {
  createListingSchema,
  marketplaceUpdateSchema,
};
