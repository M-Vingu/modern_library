const express = require('express');
const router = express.Router();

const User = require('../models/user');
const { register, login } = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../middleware/validateRequest');
const { userRegisterSchema, userLoginSchema } = require('../validations/legacySchemas');

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'user-auth',
});

// REGISTER
router.post('/register', authLimiter, validateRequest(userRegisterSchema), register);

// LOGIN
router.post('/login', authLimiter, validateRequest(userLoginSchema), login);

// GET ALL USERS (TEST)
router.get('/', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-__v');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
