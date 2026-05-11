const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');

const aiChatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
    sessionId: z.string().min(8).max(120).optional(),
    promptVersion: z.string().min(1).max(80).optional(),
    context: z.record(z.any()).optional(),
    resourceSelections: z.array(z.object({
      resourceType: z.enum(['book', 'course', 'past_paper']),
      resourceId: z.string().min(8).max(120),
    })).max(10).optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1).max(4000),
      timestamp: z.string().optional(),
    })).max(40).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const aiConversationHistorySchema = z.object({
  body: passthroughObject,
  params: z.object({
    sessionId: z.string().min(8).max(120),
  }),
  query: passthroughObject,
});

const aiConversationListSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    q: z.string().min(1).max(200).optional(),
    status: z.enum(['active', 'archived']).optional(),
  }).passthrough(),
});

module.exports = {
  aiChatSchema,
  aiConversationHistorySchema,
  aiConversationListSchema,
};
