const { z } = require('zod');

const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    subject: z.string().min(1).max(120),
    dueDate: z.string(),
    rubric: z.record(z.any()).optional(),
    status: z.enum(['draft', 'published', 'closed']).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const submitAssignmentSchema = z.object({
  body: z.object({
    assignmentId: z.string().min(8),
    content: z.string().min(1),
    attachmentUrls: z.array(z.string().url()).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const aiGradeSchema = z.object({
  body: z.object({
    score: z.number().min(0).max(100).optional(),
    feedback: z.string().max(10000).optional(),
    rubricBreakdown: z.record(z.any()).optional(),
  }),
  params: z.object({ id: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

const finalizeSchema = z.object({
  body: z.object({
    finalScore: z.number().min(0).max(100),
    overrideReason: z.string().min(3).max(1000),
  }),
  params: z.object({ id: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

module.exports = { createAssignmentSchema, submitAssignmentSchema, aiGradeSchema, finalizeSchema };
