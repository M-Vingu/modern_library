const { buildConversationSummary, buildConversationTitle } = require('./aiConversationStore');
const { requestOpenAiJson } = require('./openAiJsonService');
const { recordAiTelemetry } = require('./aiTelemetryService');
const {
  getConfiguredAiProvider,
  getConfiguredOpenAiModel,
  getConfiguredPromptVersion,
} = require('./aiRuntimeConfig');

function summarizeConversationLocally({ messages = [] }) {
  const summary = buildConversationSummary(messages);
  return {
    title: summary.title || buildConversationTitle(messages),
    summary: summary.summary || 'Study session summary unavailable.',
  };
}

async function summarizeConversation({
  messages = [],
  status = 'active',
  promptVersion,
  endpoint = 'ai.summary',
  requestId = null,
  sessionId = null,
  userId = null,
  attempt = 1,
}) {
  const startedAt = Date.now();
  const local = summarizeConversationLocally({ messages });
  const provider = getConfiguredAiProvider();
  const resolvedPromptVersion = getConfiguredPromptVersion({
    endpoint,
    requestedPromptVersion: promptVersion,
  });

  async function recordSummaryTelemetry({
    resolvedProvider,
    success,
    fallbackUsed,
    model,
    errorMessage,
    tokenUsage,
  }) {
    await recordAiTelemetry({
      userId,
      sessionId,
      endpoint,
      requestId,
      provider: resolvedProvider,
      model,
      promptVersion: resolvedPromptVersion,
      responseTimeMs: Date.now() - startedAt,
      tokenUsage,
      success,
      fallbackUsed,
      sessionStatus: status,
      messageCount: Array.isArray(messages) ? messages.length : 0,
      errorMessage,
    });
  }

  if (provider !== 'openai') {
    await recordSummaryTelemetry({
      resolvedProvider: 'mock',
      success: true,
      fallbackUsed: true,
      model: 'scaffold-v2',
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    return {
      ...local,
      provider: 'mock',
      fallbackUsed: true,
      meta: {
        endpoint,
        requestId,
        sessionId,
        userId,
        promptVersion: resolvedPromptVersion,
        model: 'scaffold-v2',
        attempt,
      },
    };
  }

  try {
    const compactMessages = messages.slice(-12).map((entry) => ({
      role: entry.role,
      content: entry.content,
      timestamp: entry.timestamp,
    }));

    const result = await requestOpenAiJson({
      model: getConfiguredOpenAiModel(),
      timeoutMs: Number(process.env.OPENAI_API_TIMEOUT_MS || 15000),
      input: [
        {
          role: 'system',
          content: `Generate a concise study-session title and summary for prompt version ${resolvedPromptVersion}. Return valid JSON with keys title and summary only.`,
        },
        {
          role: 'user',
          content: JSON.stringify({ status, messages: compactMessages }),
        },
      ],
    });

    await recordSummaryTelemetry({
      resolvedProvider: 'openai',
      success: true,
      fallbackUsed: false,
      model: getConfiguredOpenAiModel(),
      tokenUsage: result.usage,
    });

    return {
      title: String(result.parsed.title || local.title).slice(0, 80),
      summary: String(result.parsed.summary || local.summary).slice(0, 240),
      provider: 'openai',
      fallbackUsed: false,
      meta: {
        endpoint,
        requestId,
        sessionId,
        userId,
        promptVersion: resolvedPromptVersion,
        model: getConfiguredOpenAiModel(),
        attempt,
      },
    };
  } catch (err) {
    await recordSummaryTelemetry({
      resolvedProvider: 'mock',
      success: false,
      fallbackUsed: true,
      model: 'scaffold-v2',
      errorMessage: err.message,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    return {
      ...local,
      provider: 'mock',
      fallbackUsed: true,
      meta: {
        endpoint,
        requestId,
        sessionId,
        userId,
        promptVersion: resolvedPromptVersion,
        model: 'scaffold-v2',
        attempt,
      },
    };
  }
}

module.exports = {
  summarizeConversation,
  summarizeConversationLocally,
};
