const { z } = require('zod');
const { moneyObject, passthroughObject } = require('./commonSchemas');

const rideCreateSchema = z.object({
  body: z.object({
    from: z.string().min(1).max(200),
    to: z.string().min(1).max(200),
    driver: z.string().max(200).optional(),
    seats: z.coerce.number().int().min(0).optional(),
    price: moneyObject,
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = { rideCreateSchema };
