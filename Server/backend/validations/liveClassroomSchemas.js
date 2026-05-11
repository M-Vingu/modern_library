const { z } = require('zod');
const { objectId, passthroughObject } = require('./commonSchemas');

const liveClassroomCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    subject: z.string().max(200).optional(),
    teacherIds: z.array(objectId).optional(),
    learnerIds: z.array(objectId).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    accessCode: z.string().max(120).optional().nullable(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const liveClassroomSessionCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    scheduledAt: z.string().min(1),
    durationMinutes: z.coerce.number().int().min(5).max(600).optional(),
    provider: z.enum(['jitsi', 'zoom', 'custom']).optional(),
  }),
  params: z.object({ classroomId: objectId }),
  query: passthroughObject,
});

const sessionIdParamSchema = z.object({
  body: passthroughObject,
  params: z.object({ sessionId: objectId }),
  query: passthroughObject,
});

module.exports = {
  liveClassroomCreateSchema,
  liveClassroomSessionCreateSchema,
  sessionIdParamSchema,
};
