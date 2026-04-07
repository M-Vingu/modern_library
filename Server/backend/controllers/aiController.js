const { generateChatReply } = require('../services/aiChatService');

async function chatWithTutor(req, res) {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    const response = await generateChatReply({
      message,
      context: context || {},
      user: req.user || null,
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function aiHealth(_req, res) {
  res.json({
    status: 'ok',
    provider: process.env.AI_PROVIDER || 'mock',
    model: process.env.AI_MODEL || 'scaffold-v1',
  });
}

module.exports = { chatWithTutor, aiHealth };
