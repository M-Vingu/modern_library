const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id');
const currency = z.enum(['KES', 'USD', 'EUR', 'GBP']);
const passthroughObject = z.object({}).passthrough();

const moneyObject = z.object({
  amount: z.coerce.number().min(0),
  currency: currency.optional(),
});

const idParamOnlySchema = z.object({
  body: passthroughObject,
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

module.exports = {
  objectId,
  currency,
  passthroughObject,
  moneyObject,
  idParamOnlySchema,
};
