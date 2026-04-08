const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const { chatWithTutor, aiHealth } = require('../controllers/aiController');
const { aiChatSchema } = require('../validations/legacySchemas');

router.get('/health', aiHealth);
router.post('/chat', protect, validateRequest(aiChatSchema), chatWithTutor);

module.exports = router;
