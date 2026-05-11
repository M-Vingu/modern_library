const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');

const hostelCreateSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    rooms: z.coerce.number().int().min(0).optional(),
    price: z.coerce.number().min(0),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = { hostelCreateSchema };
