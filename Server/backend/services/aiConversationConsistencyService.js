const AIConversation = require('../models/AIConversation');
const { buildConversationSummary, buildConversationTitle } = require('./aiConversationStore');
const { logger } = require('../utils/logger');

function isMeaningfulText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidStatus(value) {
  return value === 'active' || value === 'archived';
}

function getMessageDate(message) {
  if (!message?.timestamp) return null;
  const date = new Date(message.timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveTimestamps(messages = [], fallbackCreatedAt, fallbackUpdatedAt) {
  const dates = messages.map(getMessageDate).filter(Boolean).sort((a, b) => a - b);
  return {
    createdAt: fallbackCreatedAt || dates[0] || new Date(),
    updatedAt: fallbackUpdatedAt || dates[dates.length - 1] || fallbackCreatedAt || new Date(),
  };
}

function buildConsistencyPatch(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const derived = buildConversationSummary(messages, conversation?.summary || '');
  const patch = {};

  if (!isMeaningfulText(conversation?.title)) {
    const nextTitle = derived.title || buildConversationTitle(messages);
    if (isMeaningfulText(nextTitle)) patch.title = nextTitle.slice(0, 80);
  }

  if (!isMeaningfulText(conversation?.summary)) {
    const nextSummary = derived.summary || 'Study session summary unavailable.';
    patch.summary = String(nextSummary).slice(0, 240);
  }

  if (!isValidStatus(conversation?.status)) {
    patch.status = conversation?.archivedAt ? 'archived' : 'active';
  }

  if (conversation?.status === 'archived' && !conversation?.archivedAt) {
    patch.archivedAt = derived.latestMessageAt || conversation.updatedAt || new Date();
  }

  if (!conversation?.lastActiveAt && derived.lastActiveAt) patch.lastActiveAt = derived.lastActiveAt;
  if (!conversation?.latestMessageAt && derived.latestMessageAt) patch.latestMessageAt = derived.latestMessageAt;
  if (!conversation?.latestMessageRole && derived.latestMessageRole) patch.latestMessageRole = derived.latestMessageRole;
  if (!isMeaningfulText(conversation?.lastMessagePreview) && derived.lastMessagePreview) {
    patch.lastMessagePreview = derived.lastMessagePreview;
  }
  if (!Number.isFinite(conversation?.messageCount) || conversation.messageCount < 0) {
    patch.messageCount = derived.messageCount;
  }

  const timestamps = deriveTimestamps(messages, conversation?.createdAt, conversation?.updatedAt);
  if (!conversation?.createdAt) patch.createdAt = timestamps.createdAt;
  if (!conversation?.updatedAt) patch.updatedAt = timestamps.updatedAt;

  return patch;
}

async function backfillAiConversationConsistency({
  sessionId,
  limit = 200,
  dryRun = false,
  log = logger,
} = {}) {
  const filter = {};
  if (sessionId) filter.sessionId = sessionId;

  const conversations = await AIConversation.find(filter)
    .sort({ updatedAt: 1 })
    .limit(Math.max(Number(limit) || 1, 1));

  const results = [];
  for (const conversation of conversations) {
    const patch = buildConsistencyPatch(conversation);
    const changedFields = Object.keys(patch);

    if (!changedFields.length) {
      results.push({ sessionId: conversation.sessionId, changed: false, fields: [] });
      continue;
    }

    if (!dryRun) {
      for (const [key, value] of Object.entries(patch)) {
        conversation.set(key, value);
      }
      await conversation.save();
    }

    log.info({
      sessionId: conversation.sessionId,
      changedFields,
      dryRun,
    }, 'ai_conversation_backfill_applied');

    results.push({
      sessionId: conversation.sessionId,
      changed: true,
      fields: changedFields,
    });
  }

  const changedCount = results.filter((item) => item.changed).length;
  return {
    scannedCount: results.length,
    changedCount,
    unchangedCount: results.length - changedCount,
    dryRun,
    items: results,
  };
}

module.exports = {
  backfillAiConversationConsistency,
  buildConsistencyPatch,
};
