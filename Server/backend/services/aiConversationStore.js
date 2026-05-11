const crypto = require('crypto');
const AIConversation = require('../models/AIConversation');

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const MAX_MESSAGES_PER_CONVERSATION = toPositiveInt(process.env.AI_CHAT_MAX_MESSAGES, 40);
const ARCHIVE_DAYS = toPositiveInt(process.env.AI_CHAT_ARCHIVE_DAYS, 30);
const DELETE_DAYS = toPositiveInt(process.env.AI_CHAT_DELETE_DAYS, 180);

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildConversationTitle(messages = [], existingTitle = '') {
  if (existingTitle) return existingTitle;
  const firstUserMessage = (Array.isArray(messages) ? messages : []).find((entry) => entry.role === 'user');
  return firstUserMessage?.content ? String(firstUserMessage.content).slice(0, 80) : '';
}

function buildConversationSummary(messages = [], existingSummary = '') {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const lastMessage = normalizedMessages.length > 0 ? normalizedMessages[normalizedMessages.length - 1] : null;
  const firstUserMessage = normalizedMessages.find((entry) => entry.role === 'user');
  const latestAssistantMessage = [...normalizedMessages].reverse().find((entry) => entry.role === 'assistant');

  const parts = [];
  if (firstUserMessage?.content) parts.push(`Started with: ${String(firstUserMessage.content).slice(0, 100)}`);
  if (latestAssistantMessage?.content) parts.push(`Latest reply: ${String(latestAssistantMessage.content).slice(0, 120)}`);
  const summaryText = parts.join(' | ').slice(0, 240);

  return {
    title: buildConversationTitle(normalizedMessages),
    summary: summaryText || existingSummary || '',
    messageCount: normalizedMessages.length,
    lastMessagePreview: lastMessage?.content ? String(lastMessage.content).slice(0, 160) : '',
    latestMessageRole: lastMessage?.role || null,
    latestMessageAt: lastMessage?.timestamp || null,
    lastActiveAt: lastMessage?.timestamp || null,
  };
}

function normalizeLinkedResources(resources = []) {
  const items = Array.isArray(resources) ? resources : [];
  const seen = new Set();

  return items
    .map((item) => ({
      resourceType: item.resourceType,
      resourceId: String(item.resourceId || '').trim(),
      label: normalizeText(item.label),
    }))
    .filter((item) => item.resourceType && item.resourceId && item.label)
    .filter((item) => {
      const key = `${item.resourceType}:${item.resourceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeHistory(messages = []) {
  return messages.map((entry) => ({
    role: entry.role,
    content: entry.content,
    timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
  }));
}

function createSessionId() {
  return crypto.randomUUID();
}

async function getConversation({ userId, sessionId, createIfMissing = true }) {
  const resolvedSessionId = normalizeText(sessionId) || createSessionId();
  let conversation = await AIConversation.findOne({ userId, sessionId: resolvedSessionId });

  if (!conversation && createIfMissing) {
    conversation = await AIConversation.create({
      userId,
      sessionId: resolvedSessionId,
      messages: [],
      linkedResources: [],
      ...buildConversationSummary([]),
    });
  }

  if (!conversation) return null;

  return {
    sessionId: conversation.sessionId,
    userId: conversation.userId?.toString?.() || userId || null,
    history: normalizeHistory(conversation.messages || []),
    linkedResources: normalizeLinkedResources(conversation.linkedResources || []),
    title: conversation.title || '',
    summary: conversation.summary || '',
    status: conversation.status || 'active',
    archivedAt: conversation.archivedAt instanceof Date ? conversation.archivedAt.toISOString() : conversation.archivedAt,
    createdAt: conversation.createdAt instanceof Date ? conversation.createdAt.toISOString() : conversation.createdAt,
    updatedAt: conversation.updatedAt instanceof Date ? conversation.updatedAt.toISOString() : conversation.updatedAt,
  };
}

async function seedConversationHistory({ userId, sessionId, history = [] }) {
  const conversation = await AIConversation.findOne({ userId, sessionId });
  if (!conversation) {
    const seededMessages = (Array.isArray(history) ? history : [])
      .map((entry) => ({
        role: entry.role,
        content: normalizeText(entry.content),
        timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
      }))
      .filter((entry) => entry.content && ['user', 'assistant', 'system'].includes(entry.role))
      .slice(-MAX_MESSAGES_PER_CONVERSATION);

    const created = await AIConversation.create({
      userId,
      sessionId,
      messages: seededMessages,
      linkedResources: [],
      ...buildConversationSummary(seededMessages),
    });
    return {
      sessionId: created.sessionId,
      userId: created.userId?.toString?.() || userId || null,
      history: normalizeHistory(created.messages || []),
      linkedResources: normalizeLinkedResources(created.linkedResources || []),
      title: created.title || '',
      summary: created.summary || '',
      status: created.status || 'active',
      archivedAt: created.archivedAt instanceof Date ? created.archivedAt.toISOString() : created.archivedAt,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  if ((conversation.messages || []).length > 0 || !Array.isArray(history) || history.length === 0) {
    return {
      sessionId: conversation.sessionId,
      userId: conversation.userId?.toString?.() || userId || null,
      history: normalizeHistory(conversation.messages || []),
      linkedResources: normalizeLinkedResources(conversation.linkedResources || []),
      title: conversation.title || '',
      summary: conversation.summary || '',
      status: conversation.status || 'active',
      archivedAt: conversation.archivedAt instanceof Date ? conversation.archivedAt.toISOString() : conversation.archivedAt,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  conversation.messages = history
    .map((entry) => ({
      role: entry.role,
      content: normalizeText(entry.content),
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    }))
    .filter((entry) => entry.content && ['user', 'assistant', 'system'].includes(entry.role))
    .slice(-MAX_MESSAGES_PER_CONVERSATION);
  Object.assign(conversation, buildConversationSummary(conversation.messages, conversation.summary));
  await conversation.save();

  return {
    sessionId: conversation.sessionId,
    userId: conversation.userId?.toString?.() || userId || null,
    history: normalizeHistory(conversation.messages || []),
    title: conversation.title || '',
    summary: conversation.summary || '',
    status: conversation.status || 'active',
    archivedAt: conversation.archivedAt instanceof Date ? conversation.archivedAt.toISOString() : conversation.archivedAt,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function appendConversationMessage({ userId, sessionId, role, content }) {
  const safeContent = normalizeText(content);
  if (!safeContent) {
    return getConversation({ userId, sessionId });
  }

  let conversation = await AIConversation.findOne({ userId, sessionId });
  if (!conversation) {
    conversation = await AIConversation.create({
      userId,
      sessionId,
      messages: [],
      linkedResources: [],
      ...buildConversationSummary([]),
    });
  }

  conversation.status = 'active';
  conversation.archivedAt = null;
  conversation.messages.push({
    role,
    content: safeContent,
    timestamp: new Date(),
  });

  if (conversation.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
  }
  Object.assign(conversation, buildConversationSummary(conversation.messages, conversation.summary));

  await conversation.save();

  return {
    sessionId: conversation.sessionId,
    userId: conversation.userId?.toString?.() || userId || null,
    history: normalizeHistory(conversation.messages || []),
    linkedResources: normalizeLinkedResources(conversation.linkedResources || []),
    title: conversation.title || '',
    summary: conversation.summary || '',
    status: conversation.status || 'active',
    archivedAt: conversation.archivedAt instanceof Date ? conversation.archivedAt.toISOString() : conversation.archivedAt,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function updateConversationSession({
  userId,
  sessionId,
  title,
  status,
  linkedResources,
}) {
  const conversation = await AIConversation.findOne({ userId, sessionId });
  if (!conversation) return null;

  if (typeof title === 'string' && normalizeText(title)) {
    conversation.title = normalizeText(title).slice(0, 80);
  }
  if (status === 'active' || status === 'archived') {
    conversation.status = status;
    conversation.archivedAt = status === 'archived' ? new Date() : null;
  }
  if (Array.isArray(linkedResources)) {
    conversation.linkedResources = normalizeLinkedResources(linkedResources);
  }

  await conversation.save();
  return getConversation({ userId, sessionId, createIfMissing: false });
}

async function deleteConversationSession({ userId, sessionId }) {
  const result = await AIConversation.deleteOne({ userId, sessionId });
  return result.deletedCount > 0;
}

async function listConversationSessionsByStatus({ userId, status }) {
  const filter = { userId };
  if (status) filter.status = status;
  return AIConversation.find(filter).sort({ updatedAt: -1 }).lean();
}

async function enforceConversationRetention({ userId }) {
  const now = new Date();
  const archiveBefore = new Date(now.getTime() - (ARCHIVE_DAYS * 24 * 60 * 60 * 1000));
  const deleteBefore = new Date(now.getTime() - (DELETE_DAYS * 24 * 60 * 60 * 1000));

  if (ARCHIVE_DAYS > 0) {
    await AIConversation.updateMany(
      {
        userId,
        status: 'active',
        $or: [
          { lastActiveAt: { $lt: archiveBefore } },
          { updatedAt: { $lt: archiveBefore } },
        ],
      },
      {
        $set: {
          status: 'archived',
          archivedAt: now,
        },
      },
    );
  }

  if (DELETE_DAYS > 0 && DELETE_DAYS > ARCHIVE_DAYS) {
    await AIConversation.deleteMany({
      userId,
      status: 'archived',
      archivedAt: { $lt: deleteBefore },
    });
  }
}

async function clearConversationStore() {
  await AIConversation.deleteMany({});
}

module.exports = {
  appendConversationMessage,
  buildConversationSummary,
  buildConversationTitle,
  clearConversationStore,
  createSessionId,
  deleteConversationSession,
  enforceConversationRetention,
  getConversation,
  listConversationSessionsByStatus,
  normalizeLinkedResources,
  seedConversationHistory,
  updateConversationSession,
};
