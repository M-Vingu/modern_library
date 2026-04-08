const { z } = require('zod');

const createKidProfileSchema = z.object({
  body: z.object({
    userId: z.string().min(8),
    displayName: z.string().min(1).max(120),
    birthYear: z.number().int().min(2000).max(2100),
    ageBand: z.enum(['3-5', '6-8', '9-12', '13-17']),
    language: z.string().max(20).optional(),
    avatarUrl: z.string().url().optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const kidProgressSchema = z.object({
  body: z.object({
    kidId: z.string().min(8),
    contentId: z.string().min(8),
    completionPct: z.number().min(0).max(100),
    score: z.number().min(0).max(100).optional(),
    timeSpentSec: z.number().min(0).optional(),
    attempts: z.number().int().min(0).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const parentControlSchema = z.object({
  body: z.object({
    dailyScreenLimitMin: z.number().int().min(5).max(360).optional(),
    allowedTopics: z.array(z.string().max(60)).optional(),
    blockedTopics: z.array(z.string().max(60)).optional(),
    interactionMode: z.enum(['solo_only', 'approved_only']).optional(),
    purchasePinEnabled: z.boolean().optional(),
  }),
  params: z.object({ kidId: z.string().min(8) }),
  query: z.object({}).passthrough(),
});

module.exports = { createKidProfileSchema, kidProgressSchema, parentControlSchema };
