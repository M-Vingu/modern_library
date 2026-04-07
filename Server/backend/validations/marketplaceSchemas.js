const { z } = require('zod');

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
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

module.exports = { createListingSchema };
