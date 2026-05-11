const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');
const { passwordSchema } = require('./authSchemas');

const userRegisterSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: passwordSchema,
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const userLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = {
  userRegisterSchema,
  userLoginSchema,
};
