const AIConversation = require('../models/AIConversation');
const aiSessionSummaryService = require('./aiSessionSummaryService');
const { getMaintenanceConfig } = require('./aiRuntimeConfig');
const { logger } = require('../utils/logger');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(task, { attempts, delayMs, onRetry }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= attempts) break;
      if (typeof onRetry === 'function') onRetry(err, attempt);
      await wait(delayMs);
    }
  }
  throw lastError;
}

function buildMaintenanceFilter({ inactiveDays, sessionId, status, now = new Date() }) {
  if (sessionId) return { sessionId };

  const cutoff = new Date(now.getTime() - (inactiveDays * 24 * 60 * 60 * 1000));
  if (status === 'active' || status === 'archived') {
    if (status === 'archived') return { status: 'archived' };
    return {
      status: 'active',
      $or: [
        { lastActiveAt: { $lt: cutoff } },
        { updatedAt: { $lt: cutoff } },
      ],
    };
  }

  return {
    $or: [
      { status: 'archived' },
      {
        status: 'active',
        $or: [
          { lastActiveAt: { $lt: cutoff } },
          { updatedAt: { $lt: cutoff } },
        ],
      },
    ],
  };
}

async function resummarizeSingleConversation(conversation, options = {}) {
  const config = getMaintenanceConfig();
  const retryAttempts = Math.max(Number(options.retryAttempts) || config.retryAttempts, 1);
  const retryDelayMs = Math.max(Number(options.retryDelayMs) || config.retryDelayMs, 1);
  const archiveInactive = options.archiveInactive !== false;
  const shouldArchive = archiveInactive && conversation.status === 'active';

  return withRetries(async (attempt) => {
    const improved = await aiSessionSummaryService.summarizeConversation({
      messages: conversation.messages || [],
      status: shouldArchive ? 'archived' : conversation.status,
      promptVersion: options.promptVersion,
      endpoint: 'job:ai-session-maintenance',
      requestId: options.requestId,
      sessionId: conversation.sessionId,
      userId: conversation.userId?.toString?.() || null,
      attempt,
    });

    conversation.title = improved.title || conversation.title;
    conversation.summary = improved.summary || conversation.summary;

    if (shouldArchive) {
      conversation.status = 'archived';
      conversation.archivedAt = conversation.archivedAt || new Date();
    }

    await conversation.save();

    return {
      sessionId: conversation.sessionId,
      provider: improved.provider,
      fallbackUsed: Boolean(improved.fallbackUsed),
      status: conversation.status,
      title: conversation.title,
      summary: conversation.summary,
    };
  }, {
    attempts: retryAttempts,
    delayMs: retryDelayMs,
    onRetry: (err, attempt) => {
      logger.warn({
        sessionId: conversation.sessionId,
        attempt,
        err: err.message,
      }, 'ai_session_maintenance_retry');
    },
  });
}

async function runAiSessionMaintenance({
  inactiveDays,
  limit,
  sessionId,
  status,
  retryAttempts,
  retryDelayMs,
  archiveInactive = true,
  requestId,
} = {}) {
  const config = getMaintenanceConfig();
  const effectiveInactiveDays = Math.max(Number(inactiveDays) || config.inactiveDays, 1);
  const effectiveLimit = Math.max(Number(limit) || config.batchLimit, 1);
  const filter = buildMaintenanceFilter({
    inactiveDays: effectiveInactiveDays,
    sessionId,
    status,
  });

  const conversations = await AIConversation.find(filter)
    .sort({ updatedAt: 1 })
    .limit(effectiveLimit);

  const items = [];
  for (const conversation of conversations) {
    try {
      const result = await resummarizeSingleConversation(conversation, {
        retryAttempts,
        retryDelayMs,
        archiveInactive,
        requestId,
      });
      items.push({ ...result, success: true });
    } catch (err) {
      logger.error({
        sessionId: conversation.sessionId,
        err: err.message,
      }, 'ai_session_maintenance_failed');

      items.push({
        sessionId: conversation.sessionId,
        success: false,
        error: err.message,
        status: conversation.status,
      });
    }
  }

  return {
    success: true,
    filter,
    processedCount: items.length,
    updatedCount: items.filter((item) => item.success).length,
    failedCount: items.filter((item) => item.success === false).length,
    items,
  };
}

module.exports = {
  buildMaintenanceFilter,
  resummarizeSingleConversation,
  runAiSessionMaintenance,
};
