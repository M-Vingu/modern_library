const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Wallet = require("../models/wallet");
const { createRateLimiter } = require("../middleware/rateLimiter");

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

// REGISTER
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    if (!SECRET) return res.status(500).json({ message: "JWT secret not configured" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: "User already exists" });

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

    res.status(201).json({ message: "User registered", user });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }
    if (!SECRET) return res.status(500).json({ message: "JWT secret not configured" });

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, SECRET, getJwtSignOptions());

    res.json({ message: "Login successful", token, user: user.toJSON() });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
