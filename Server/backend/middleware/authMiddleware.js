const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/user');
const TokenBlocklist = require('../models/TokenBlocklist');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (mongoose.connection.readyState === 1) {
      const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
      const blocked = await TokenBlocklist.findOne({ tokenHash }).lean();
      if (blocked) return res.status(401).json({ message: 'Token has been revoked' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ message: 'JWT secret not configured' });
    const verifyOptions = {
      algorithms: ['HS256'],
    };
    if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;

    const decoded = jwt.verify(token, secret, verifyOptions);
    const user = await User.findById(decoded.id).select('_id role');
    if (!user) return res.status(401).json({ message: 'User not found for token' });

    // Keep both keys for compatibility with existing route code.
    req.user = { id: user._id.toString(), _id: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = protect;
module.exports.protect = protect;
