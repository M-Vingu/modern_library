const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user");
const Wallet = require("../models/wallet");
const RefreshToken = require("../models/RefreshToken");
const TokenBlocklist = require("../models/TokenBlocklist");
const { createRateLimiter } = require("../middleware/rateLimiter");
const protect = require("../middleware/authMiddleware");
const { writeAuditLog } = require("../services/auditLogService");
const { validateRequest } = require("../middleware/validateRequest");
const { registerSchema, loginSchema, refreshSchema } = require("../validations/authSchemas");

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth",
});

function getJwtSignOptions() {
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    algorithm: "HS256",
  };
  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
  return options;
}

const SECRET = process.env.JWT_SECRET;
const REFRESH_TTL_SEC = Number(process.env.REFRESH_TOKEN_TTL_SEC || 60 * 60 * 24 * 30);

function fail(res, status, code, message, details) {
  if (typeof res.fail === "function") return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function issueAccessToken(user) {
  return jwt.sign({ id: user._id, role: user.role || "user" }, SECRET, getJwtSignOptions());
}

async function issueRefreshToken(userId, ip) {
  const raw = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
    createdByIp: ip,
  });
  return { token: raw, expiresAt };
}

// REGISTER
router.post("/register", authLimiter, validateRequest(registerSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return fail(res, 400, "AUTH_REGISTER_INVALID_INPUT", "name, email and password are required");
    }
    if (String(password).length < 8) {
      return fail(res, 400, "AUTH_PASSWORD_TOO_SHORT", "Password must be at least 8 characters");
    }
    if (!SECRET) return fail(res, 500, "AUTH_SECRET_MISSING", "JWT secret not configured");

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return fail(res, 400, "AUTH_USER_EXISTS", "User already exists");

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: normalizedEmail,
      password: hashed,
      referralCode: Math.random().toString(36).substring(2, 8)
    });

    await user.save();

    // 🔥 Create wallet
    const wallet = await Wallet.create({ userId: user._id });
    user.wallet = wallet._id;
    await user.save();

    const accessToken = issueAccessToken(user);
    const refresh = await issueRefreshToken(user._id, req.ip);

    await writeAuditLog(req, {
      action: "auth.register",
      targetType: "user",
      targetId: user._id,
      metadata: { email: normalizedEmail },
    });

    res.status(201).json({
      message: "User registered",
      user,
      token: accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    });

  } catch (err) {
    await writeAuditLog(req, {
      action: "auth.register",
      targetType: "user",
      status: "failed",
      errorCode: "AUTH_REGISTER_FAILED",
      metadata: { error: err.message },
    });
    fail(res, 500, "AUTH_REGISTER_FAILED", err.message);
  }
});

// LOGIN
router.post("/login", authLimiter, validateRequest(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return fail(res, 400, "AUTH_LOGIN_INVALID_INPUT", "email and password are required");
    }
    if (!SECRET) return fail(res, 500, "AUTH_SECRET_MISSING", "JWT secret not configured");

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) return fail(res, 400, "AUTH_INVALID_CREDENTIALS", "Invalid credentials");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return fail(res, 400, "AUTH_INVALID_CREDENTIALS", "Invalid credentials");

    // MFA-ready hook: challenge required for privileged users when MFA is enabled.
    if (user.mfaEnabled && ["admin"].includes(user.role)) {
      await writeAuditLog(req, {
        action: "auth.mfa.challenge_requested",
        targetType: "user",
        targetId: user._id,
        metadata: { mfaMethod: user.mfaMethod, phase: "post_password_login" },
      });
      return res.status(202).json({
        message: "MFA challenge required",
        code: "AUTH_MFA_REQUIRED",
        mfa: {
          required: true,
          method: user.mfaMethod,
        },
      });
    }

    const token = issueAccessToken(user);
    const refresh = await issueRefreshToken(user._id, req.ip);
    user.lastLogin = new Date();
    await user.save();

    await writeAuditLog(req, {
      action: "auth.login",
      targetType: "user",
      targetId: user._id,
      metadata: { email: normalizedEmail },
    });

    res.json({
      message: "Login successful",
      token,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: user.toJSON(),
    });

  } catch (err) {
    await writeAuditLog(req, {
      action: "auth.login",
      targetType: "user",
      status: "failed",
      errorCode: "AUTH_LOGIN_FAILED",
      metadata: { error: err.message },
    });
    fail(res, 500, "AUTH_LOGIN_FAILED", err.message);
  }
});

router.post("/refresh", authLimiter, validateRequest(refreshSchema), async (req, res) => {
  try {
    if (!SECRET) return fail(res, 500, "AUTH_SECRET_MISSING", "JWT secret not configured");
    const { refreshToken } = req.body;
    if (!refreshToken) return fail(res, 400, "AUTH_REFRESH_TOKEN_REQUIRED", "refreshToken is required");

    const tokenHash = hashToken(refreshToken);
    const record = await RefreshToken.findOne({ tokenHash });
    if (!record || record.revokedAt || record.expiresAt <= new Date()) {
      return fail(res, 401, "AUTH_REFRESH_TOKEN_INVALID", "Refresh token is invalid or expired");
    }

    const user = await User.findById(record.userId);
    if (!user) return fail(res, 401, "AUTH_USER_NOT_FOUND", "User not found for refresh token");

    record.revokedAt = new Date();
    const nextRefresh = await issueRefreshToken(user._id, req.ip);
    record.replacedByTokenHash = hashToken(nextRefresh.token);
    await record.save();

    const token = issueAccessToken(user);
    await writeAuditLog(req, {
      action: "auth.refresh",
      targetType: "user",
      targetId: user._id,
    });

    res.json({
      message: "Token refreshed",
      token,
      refreshToken: nextRefresh.token,
      refreshExpiresAt: nextRefresh.expiresAt,
    });
  } catch (err) {
    fail(res, 500, "AUTH_REFRESH_FAILED", err.message);
  }
});

router.post("/logout", protect, async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
    }

    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      const accessToken = authHeader.split(" ")[1];
      try {
        const decoded = jwt.decode(accessToken);
        const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 60 * 60 * 1000);
        await TokenBlocklist.findOneAndUpdate(
          { tokenHash: hashToken(accessToken) },
          { $setOnInsert: { expiresAt, reason: "logout" } },
          { upsert: true },
        );
      } catch (_err) {
        // Ignore decode errors for logout; best effort revocation.
      }
    }

    await writeAuditLog(req, {
      action: "auth.logout",
      targetType: "user",
      targetId: req.user.id,
    });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    fail(res, 500, "AUTH_LOGOUT_FAILED", err.message);
  }
});

router.post("/mfa/challenge", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("mfaEnabled mfaMethod role");
  if (!user) return fail(res, 404, "AUTH_USER_NOT_FOUND", "User not found");

  await writeAuditLog(req, {
    action: "auth.mfa.challenge_requested",
    targetType: "user",
    targetId: user._id,
    metadata: { method: user.mfaMethod },
  });

  return res.status(202).json({
    message: "MFA challenge scaffold emitted",
    code: "AUTH_MFA_CHALLENGE_SENT",
    mfa: {
      enabled: user.mfaEnabled,
      method: user.mfaMethod,
      challengeId: crypto.randomUUID(),
    },
  });
});

router.post("/mfa/verify", protect, async (req, res) => {
  const { challengeId, otp } = req.body || {};
  if (!challengeId || !otp) return fail(res, 400, "AUTH_MFA_INVALID_INPUT", "challengeId and otp are required");

  // MFA scaffold hook: replace with TOTP/SMS/Email OTP verification provider.
  if (String(otp).length < 4) return fail(res, 400, "AUTH_MFA_INVALID_OTP", "Invalid OTP");

  await writeAuditLog(req, {
    action: "auth.mfa.verified",
    targetType: "user",
    targetId: req.user.id,
    metadata: { challengeId },
  });
  return res.json({ message: "MFA verified (scaffold)", verified: true });
});

module.exports = router;
