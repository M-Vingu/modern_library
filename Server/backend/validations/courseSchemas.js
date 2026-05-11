const { z } = require('zod');
const { moneyObject, objectId, passthroughObject } = require('./commonSchemas');

const courseCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    instructor: z.string().max(200).optional(),
    price: moneyObject,
    students: z.array(objectId).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = { courseCreateSchema };
