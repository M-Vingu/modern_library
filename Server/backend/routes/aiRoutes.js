const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { chatWithTutor, aiHealth } = require('../controllers/aiController');

router.get('/health', aiHealth);
router.post('/chat', protect, chatWithTutor);

module.exports = router;
