const { z } = require('zod');
const { passthroughObject } = require('./commonSchemas');
const passwordSchema = z.string()
  .min(10)
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    password: passwordSchema,
    role: z.enum(['teacher', 'student', 'parent', 'kid', 'partner']).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(16),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const mfaChallengeSchema = z.object({
  body: z.object({
    email: z.string().email(),
    method: z.enum(['totp', 'email_otp']).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const mfaVerifySchema = z.object({
  body: z.object({
    challengeId: z.string().uuid(),
    otp: z.string().min(4).max(12),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const sessionRevokeSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20).optional(),
  }),
  params: passthroughObject,
  query: passthroughObject,
});

const revokeAllSchema = z.object({
  body: passthroughObject,
  params: passthroughObject,
  query: passthroughObject,
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
  sessionRevokeSchema,
  logoutSchema,
  revokeAllSchema,
  passwordSchema,
};
