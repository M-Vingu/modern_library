const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');

const bookCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    author: z.string().min(1).max(200),
    genre: z.string().max(120).optional(),
    copies: z.coerce.number().int().min(0).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = { bookCreateSchema };
