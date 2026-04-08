const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['user', 'teacher', 'student', 'parent', 'kid', 'partner']).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(16),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const mfaChallengeSchema = z.object({
  body: z.object({
    email: z.string().email(),
    method: z.enum(['totp', 'email_otp']).optional(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const mfaVerifySchema = z.object({
  body: z.object({
    challengeId: z.string().uuid(),
    otp: z.string().min(4).max(12),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

const sessionRevokeSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
  }),
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
  sessionRevokeSchema,
};
