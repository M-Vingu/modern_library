const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/user');
const Wallet = require('../models/wallet');
const RefreshToken = require('../models/RefreshToken');
const TokenBlocklist = require('../models/TokenBlocklist');

const { createRateLimiter } = require('../middleware/rateLimiter');
const protect = require('../middleware/authMiddleware');
const { writeAuditLog } = require('../services/auditLogService');
const { validateRequest } = require('../middleware/validateRequest');
const { createMfaChallenge, verifyMfaChallenge } = require('../services/mfaService');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  mfaChallengeSchema,
  mfaVerifySchema,
  sessionRevokeSchema,
} = require('../validations/authSchemas');
const { logoutSchema, revokeAllSchema } = require('../validations/legacySchemas');

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth',
});

const SECRET = process.env.JWT_SECRET;
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL_SEC || 60 * 60 * 24 * 30);

function getJwtSignOptions() {
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  };
  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
  return options;
}

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function decodeExpDate(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) return new Date(decoded.exp * 1000);
  } catch (_err) {
    // ignore
  }
  return new Date(Date.now() + 60 * 60 * 1000);
}

function issueAccessToken(user, sessionId) {
  return jwt.sign({
    id: user._id,
    role: user.role || 'user',
    sid: sessionId,
    tver: user.tokenVersion || 0,
  }, SECRET, getJwtSignOptions());
}

async function issueRefreshToken(userId, ip, sessionId) {
  const raw = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await RefreshToken.create({
    userId,
    tokenHash,
    sessionId,
    expiresAt,
    createdByIp: ip,
  });
  return { token: raw, expiresAt, sessionId };
}

async function invalidateAccessTokenFromRequest(req, reason = 'logout') {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return;
  const accessToken = authHeader.split(' ')[1];
  await TokenBlocklist.findOneAndUpdate(
    { tokenHash: hashToken(accessToken) },
    { $setOnInsert: { expiresAt: decodeExpDate(accessToken), reason } },
    { upsert: true },
  );
}

router.post('/register', authLimiter, validateRequest(registerSchema), async (req, res) => {
  try {
    if (!SECRET) return fail(res, 500, 'AUTH_SECRET_MISSING', 'JWT secret not configured');

    const { name, email, password, role } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return fail(res, 400, 'AUTH_USER_EXISTS', 'User already exists');

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashed,
      role: role || 'user',
      referralCode: Math.random().toString(36).substring(2, 8),
    });

    const wallet = await Wallet.create({ userId: user._id });
    user.wallet = wallet._id;
    await user.save();

    const sessionId = crypto.randomUUID();
    const accessToken = issueAccessToken(user, sessionId);
    const refresh = await issueRefreshToken(user._id, req.ip, sessionId);

    await writeAuditLog(req, {
      action: 'auth.register',
      targetType: 'user',
      targetId: user._id,
      metadata: { email: normalizedEmail, role: user.role },
    });

    return res.status(201).json({
      success: true,
      message: 'User registered',
      user,
      token: accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      sessionId,
    });
  } catch (err) {
    await writeAuditLog(req, {
      action: 'auth.register',
      targetType: 'user',
      status: 'failed',
      errorCode: 'AUTH_REGISTER_FAILED',
      metadata: { error: err.message },
    });
    return fail(res, 500, 'AUTH_REGISTER_FAILED', err.message);
  }
});

router.post('/login', authLimiter, validateRequest(loginSchema), async (req, res) => {
  try {
    if (!SECRET) return fail(res, 500, 'AUTH_SECRET_MISSING', 'JWT secret not configured');

    const normalizedEmail = String(req.body.email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) return fail(res, 400, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials');

    const valid = await bcrypt.compare(req.body.password, user.password);
    if (!valid) return fail(res, 400, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials');

    if (user.mfaEnabled) {
      const method = user.mfaMethod === 'none' ? 'email_otp' : user.mfaMethod;
      const challenge = await createMfaChallenge({ userId: user._id, method, contact: user.email });
      await writeAuditLog(req, {
        action: 'auth.mfa.challenge_requested',
        targetType: 'user',
        targetId: user._id,
        metadata: { method },
      });
      return res.status(202).json({
        success: true,
        code: 'AUTH_MFA_REQUIRED',
        message: 'MFA challenge required',
        mfa: {
          required: true,
          method,
          challengeId: challenge.challengeId,
          expiresAt: challenge.expiresAt,
          otpPreview: challenge.otpPreview,
        },
      });
    }

    const sessionId = crypto.randomUUID();
    const token = issueAccessToken(user, sessionId);
    const refresh = await issueRefreshToken(user._id, req.ip, sessionId);
    user.lastLogin = new Date();
    await user.save();

    await writeAuditLog(req, {
      action: 'auth.login',
      targetType: 'user',
      targetId: user._id,
      metadata: { email: normalizedEmail },
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      sessionId,
      user: user.toJSON(),
    });
  } catch (err) {
    return fail(res, 500, 'AUTH_LOGIN_FAILED', err.message);
  }
});

router.post('/mfa/challenge', authLimiter, validateRequest(mfaChallengeSchema), async (req, res) => {
  const normalizedEmail = String(req.body.email).trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return fail(res, 404, 'AUTH_USER_NOT_FOUND', 'User not found');

  const method = req.body.method || user.mfaMethod || 'email_otp';
  const challenge = await createMfaChallenge({ userId: user._id, method, contact: user.email });
  return res.status(202).json({
    success: true,
    code: 'AUTH_MFA_CHALLENGE_SENT',
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt,
    method,
    otpPreview: challenge.otpPreview,
  });
});

router.post('/mfa/verify', authLimiter, validateRequest(mfaVerifySchema), async (req, res) => {
  const result = await verifyMfaChallenge({
    challengeId: req.body.challengeId,
    otp: req.body.otp,
  });
  if (!result.ok) return fail(res, 400, result.code, 'MFA verification failed');

  const user = await User.findById(result.userId);
  if (!user) return fail(res, 404, 'AUTH_USER_NOT_FOUND', 'User not found');

  const sessionId = crypto.randomUUID();
  const token = issueAccessToken(user, sessionId);
  const refresh = await issueRefreshToken(user._id, req.ip, sessionId);

  await writeAuditLog(req, {
    action: 'auth.mfa.verified',
    targetType: 'user',
    targetId: user._id,
    metadata: { method: result.method },
  });

  return res.json({
    success: true,
    code: 'AUTH_MFA_VERIFIED',
    token,
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
    sessionId,
  });
});

router.post('/refresh', authLimiter, validateRequest(refreshSchema), async (req, res) => {
  try {
    if (!SECRET) return fail(res, 500, 'AUTH_SECRET_MISSING', 'JWT secret not configured');

    const tokenHash = hashToken(req.body.refreshToken);
    const record = await RefreshToken.findOne({ tokenHash });
    if (!record || record.revokedAt || record.expiresAt <= new Date()) {
      return fail(res, 401, 'AUTH_REFRESH_TOKEN_INVALID', 'Refresh token is invalid or expired');
    }

    const user = await User.findById(record.userId);
    if (!user) return fail(res, 401, 'AUTH_USER_NOT_FOUND', 'User not found for refresh token');

    record.revokedAt = new Date();
    const nextRefresh = await issueRefreshToken(user._id, req.ip, record.sessionId);
    record.replacedByTokenHash = hashToken(nextRefresh.token);
    await record.save();

    const token = issueAccessToken(user, record.sessionId);
    await writeAuditLog(req, {
      action: 'auth.refresh',
      targetType: 'user',
      targetId: user._id,
      metadata: { sessionId: record.sessionId },
    });

    return res.json({
      success: true,
      message: 'Token refreshed',
      token,
      refreshToken: nextRefresh.token,
      refreshExpiresAt: nextRefresh.expiresAt,
      sessionId: record.sessionId,
    });
  } catch (err) {
    return fail(res, 500, 'AUTH_REFRESH_FAILED', err.message);
  }
});

router.post('/logout', protect, validateRequest(logoutSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.findOneAndUpdate({ tokenHash, userId: req.user.id }, { revokedAt: new Date() });
    }

    await invalidateAccessTokenFromRequest(req, 'logout');

    await writeAuditLog(req, {
      action: 'auth.logout',
      targetType: 'user',
      targetId: req.user.id,
    });

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return fail(res, 500, 'AUTH_LOGOUT_FAILED', err.message);
  }
});

router.get('/sessions', protect, async (req, res) => {
  const items = await RefreshToken.find({ userId: req.user.id })
    .select('_id sessionId createdAt expiresAt revokedAt createdByIp')
    .sort({ createdAt: -1 });
  return res.json({ success: true, items });
});

router.post('/sessions/revoke', protect, validateRequest(sessionRevokeSchema), async (req, res) => {
  const { sessionId } = req.body;
  const record = await RefreshToken.findOneAndUpdate(
    { userId: req.user.id, sessionId, revokedAt: null },
    { revokedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!record) return fail(res, 404, 'AUTH_SESSION_NOT_FOUND', 'Session not found');

  await invalidateAccessTokenFromRequest(req, 'session_revoke');

  await writeAuditLog(req, {
    action: 'auth.session.revoked',
    targetType: 'session',
    targetId: sessionId,
  });
  return res.json({ success: true, message: 'Session revoked', sessionId });
});

router.post('/sessions/revoke-all', protect, validateRequest(revokeAllSchema), async (req, res) => {
  await RefreshToken.updateMany({ userId: req.user.id, revokedAt: null }, { revokedAt: new Date() });
  await User.findByIdAndUpdate(req.user.id, { $inc: { tokenVersion: 1 } });
  await invalidateAccessTokenFromRequest(req, 'revoke_all');

  await writeAuditLog(req, {
    action: 'auth.session.revoke_all',
    targetType: 'user',
    targetId: req.user.id,
  });

  return res.json({ success: true, message: 'All sessions revoked' });
});

module.exports = router;
