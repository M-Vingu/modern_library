const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');

const resourceSelectionSchema = z.object({
  resourceType: z.enum(['book', 'course', 'past_paper']),
  resourceId: z.string().min(8).max(120),
});

const aiSessionUpdateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(80).optional(),
    status: z.enum(['active', 'archived']).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one update field is required'),
  params: z.object({
    sessionId: z.string().min(8).max(120),
  }),
  query: passthroughObject,
});

const aiSessionDeleteSchema = z.object({
  body: passthroughObject,
  params: z.object({
    sessionId: z.string().min(8).max(120),
  }),
  query: passthroughObject,
});

const aiConversationListAdvancedSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    q: z.string().min(1).max(200).optional(),
    status: z.enum(['active', 'archived']).optional(),
  }).passthrough(),
});

const aiResourceListSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: z.object({
    q: z.string().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(20).optional(),
  }).passthrough(),
});

const aiResummarizeSchema = z.object({
  body: z.object({
    sessionId: z.string().min(8).max(120).optional(),
    status: z.enum(['active', 'archived']).optional(),
    inactiveDays: z.coerce.number().int().min(1).max(365).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }).passthrough(),
  params: passthroughObject,
  query: passthroughObject,
});

const aiConversationBackfillSchema = z.object({
  body: z.object({
    sessionId: z.string().min(8).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    dryRun: z.coerce.boolean().optional(),
  }).passthrough(),
  params: passthroughObject,
  query: passthroughObject,
});

const aiTelemetryReportSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: z.object({
    range: z.enum(['daily', 'weekly', 'monthly']).optional(),
    endpoint: z.string().min(1).max(120).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }).passthrough(),
});

module.exports = {
  aiConversationListAdvancedSchema,
  aiConversationBackfillSchema,
  aiResourceListSchema,
  aiResummarizeSchema,
  aiTelemetryReportSchema,
  aiSessionDeleteSchema,
  aiSessionUpdateSchema,
  resourceSelectionSchema,
};
