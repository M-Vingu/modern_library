const { z } = require('zod');

const moneySchema = z.object({
  amount: z.number().positive(),
  description: z.string().max(300).optional(),
  type: z.string().max(30).optional(),
});

const walletMutationSchema = z.object({
  body: moneySchema,
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

module.exports = { walletMutationSchema };
