function buildStudyGuidanceReply(message, context) {
  const subject = context?.subject || 'general studies';
  const tone = context?.tone || 'supportive';

  return {
    reply: `I can help you with ${subject}. A strong next step is to break "${message}" into topics, do timed practice, and review weak areas first.`,
    guidance: [
      'Create a 45-minute focused study block.',
      'Attempt one past paper question before reading the solution.',
      'Summarize key mistakes and revise only those today.',
    ],
    tone,
  };
}

async function generateChatReply({ message, context = {}, user }) {
  const safeMessage = String(message || '').trim();
  if (!safeMessage) {
    return {
      provider: 'mock',
      ...buildStudyGuidanceReply('your topic', context),
      meta: { note: 'Message was empty. Returning scaffold guidance.' },
    };
  }

  // Scaffold mode by default. You can later swap this with an external AI provider call.
  const response = buildStudyGuidanceReply(safeMessage, context);
  return {
    provider: process.env.AI_PROVIDER || 'mock',
    ...response,
    meta: {
      userId: user?.id || null,
      model: process.env.AI_MODEL || 'scaffold-v1',
    },
  };
}

module.exports = { generateChatReply };
