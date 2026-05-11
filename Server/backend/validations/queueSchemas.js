const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');
const { allowedQueues } = require('../controllers/queueAdminController');

const queueReplaySchema = z.object({
  body: z.object({
    deadLetterJobId: z.string().min(1),
  }),
  params: z.object({
    name: z.enum(allowedQueues),
  }),
  query: passthroughObject,
});

const queueReportSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: passthroughObject,
});

const aiMaintenanceQueueActionSchema = z.object({
  body: z.object({
    sessionId: z.string().min(8).max(120).optional(),
    status: z.enum(['active', 'archived']).optional(),
    inactiveDays: z.coerce.number().int().min(1).max(365).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    retryAttempts: z.coerce.number().int().min(1).max(10).optional(),
    retryDelayMs: z.coerce.number().int().min(1).max(60000).optional(),
    archiveInactive: z.coerce.boolean().optional(),
  }).passthrough(),
  params: z.object({
    name: z.enum(['ai-session-maintenance']),
  }),
  query: passthroughObject,
});

module.exports = {
  aiMaintenanceQueueActionSchema,
  queueReplaySchema,
  queueReportSchema,
};
