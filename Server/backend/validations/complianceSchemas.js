const { z } = require('zod');

const consentSchema = z.object({
  body: z.object({
    policyType: z.enum(['terms', 'privacy', 'parental-consent']),
    policyVersion: z.string().min(1),
    metadata: z.record(z.any()).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const dsarSchema = z.object({
  body: z.object({ reason: z.string().max(1000).optional() }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const dsarStatusSchema = z.object({
  body: z.object({
    status: z.enum(['requested', 'in_progress', 'completed', 'rejected']),
    resolutionNotes: z.string().max(4000).optional(),
  }),
  params: z.object({ id: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

const retentionPolicySchema = z.object({
  body: z.object({
    collection: z.string().min(2).max(120),
    retentionDays: z.number().int().min(1).max(36500),
    mode: z.enum(['soft_delete', 'hard_delete', 'archive']).optional(),
    active: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const dsarListSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: z.object({
    status: z.enum(['requested', 'in_progress', 'completed', 'rejected']).optional(),
    requestType: z.enum(['export', 'delete']).optional(),
    userId: z.string().min(8).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).passthrough(),
});

const retentionSweepSchema = z.object({
  body: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

module.exports = {
  consentSchema,
  dsarSchema,
  dsarStatusSchema,
  retentionPolicySchema,
  dsarListSchema,
  retentionSweepSchema,
};
