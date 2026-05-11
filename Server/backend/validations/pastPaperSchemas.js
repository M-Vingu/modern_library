const { z } = require('zod');
const { objectId, passthroughObject } = require('./commonSchemas');

const pastPaperCreateSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    institution: z.string().min(1).max(300),
    course: z.string().min(1).max(300),
    unitCode: z.string().max(120).optional(),
    subject: z.string().min(1).max(300),
    year: z.coerce.number().int().min(1990).max(2100),
    examType: z.enum(['cat', 'midterm', 'endterm', 'national', 'mock', 'other']).optional(),
    semester: z.string().max(100).optional(),
    level: z.string().max(100).optional(),
    tags: z.array(z.string().max(80)).optional(),
    fileUrl: z.string().url(),
    visibility: z.enum(['public', 'private']).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const pastPaperUploadSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    institution: z.string().min(1).max(300),
    course: z.string().min(1).max(300),
    unitCode: z.string().max(120).optional(),
    subject: z.string().min(1).max(300),
    year: z.coerce.number().int().min(1990).max(2100),
    examType: z.enum(['cat', 'midterm', 'endterm', 'national', 'mock', 'other']).optional(),
    semester: z.string().max(100).optional(),
    level: z.string().max(100).optional(),
    tags: z.array(z.string().max(80)).optional(),
    visibility: z.enum(['public', 'private']).optional(),
    originalFileName: z.string().min(1).max(255),
    mimeType: z.string().max(120).optional(),
    contentBase64: z.string().min(10),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const pastPaperVerifySchema = z.object({
  body: passthroughObject,
  params: z.object({ id: objectId }),
  query: passthroughObject,
});

module.exports = {
  pastPaperCreateSchema,
  pastPaperUploadSchema,
  pastPaperVerifySchema,
};
