const { z } = require('zod');
const { moneyObject, passthroughObject } = require('./commonSchemas');

const productCreateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    price: moneyObject,
    seller: z.string().max(200).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    category: z.string().max(120).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = { productCreateSchema };
