const User = require('../models/user');
const { createWallet } = require('./walletController');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET;

function getJwtSignOptions() {
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  };
  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;
  return options;
}


// ==========================
// REGISTER
// ==========================
async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (!SECRET) return res.status(500).json({ message: 'JWT secret not configured' });

    // Check if user exists
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // 🔐 Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      referralCode: Math.random().toString(36).substring(2, 8)
    });

    await user.save();

    // 🔥 Create wallet
    const wallet = await createWallet(user._id);
    user.wallet = wallet._id;
    await user.save();

    // 🔐 Generate token
    const token = jwt.sign(
      { id: user._id },
      SECRET,
      getJwtSignOptions()
    );

    res.status(201).json({
      message: 'User registered successfully',
      user,
      wallet,
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


// ==========================
// LOGIN
// ==========================
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    if (!SECRET) return res.status(500).json({ message: 'JWT secret not configured' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // 🔐 Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    // 🔐 Generate token
    const token = jwt.sign(
      { id: user._id },
      SECRET,
      getJwtSignOptions()
    );

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login };
