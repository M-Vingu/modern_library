const { generateChatReply } = require('../services/aiChatService');
const AIConversation = require('../models/AIConversation');
const {
  appendConversationMessage,
  deleteConversationSession,
  enforceConversationRetention,
  getConversation,
  seedConversationHistory,
  updateConversationSession,
} = require('../services/aiConversationStore');
const { getAiTelemetryReport, recordAiTelemetry } = require('../services/aiTelemetryService');
const { runAiSessionMaintenance } = require('../services/aiSessionMaintenanceService');
const { fetchResourcesForTutor, resolveSelectedResources } = require('../services/learningResourceService');
const { backfillAiConversationConsistency } = require('../services/aiConversationConsistencyService');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function chatWithTutor(req, res) {
  try {
    const {
      message,
      context,
      sessionId,
      history,
      resourceSelections,
      promptVersion,
    } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    const userId = req.user?.id || null;
    await enforceConversationRetention({ userId });
    const conversation = await getConversation({ userId, sessionId });
    const activeSessionId = conversation.sessionId;
    const selectedResources = await resolveSelectedResources(resourceSelections || conversation.linkedResources || []);

    if (selectedResources.linkedResources.length > 0) {
      await updateConversationSession({
        userId,
        sessionId: activeSessionId,
        linkedResources: selectedResources.linkedResources,
      });
    }

    if (Array.isArray(history) && history.length > 0) {
      await seedConversationHistory({
        userId,
        sessionId: activeSessionId,
        history,
      });
    }

    const beforeReply = await appendConversationMessage({
      userId,
      sessionId: activeSessionId,
      role: 'user',
      content: message,
    });

    const response = await generateChatReply({
      message,
      context: context || {},
      user: req.user || null,
      sessionId: activeSessionId,
      history: beforeReply.history,
      resourceMatchesOverride: selectedResources,
      endpoint: 'ai.chat',
      requestId: req.requestId || null,
      promptVersion,
    });

    const afterReply = await appendConversationMessage({
      userId,
      sessionId: activeSessionId,
      role: 'assistant',
      content: response.reply,
    });

    await recordAiTelemetry({
      userId,
      sessionId: activeSessionId,
      endpoint: 'ai.chat',
      requestId: req.requestId || null,
      provider: response.provider,
      model: response.meta?.model,
      promptVersion: response.meta?.promptVersion,
      responseTimeMs: response.meta?.responseTimeMs,
      tokenUsage: response.meta?.tokenUsage,
      success: response.meta?.success !== false,
      fallbackUsed: response.meta?.fallbackUsed === true,
      sessionStatus: afterReply.status,
      messageCount: afterReply.history?.length,
      errorMessage: response.meta?.success === false ? response.meta?.note : undefined,
    });

    const persistedConversation = await getConversation({
      userId,
      sessionId: activeSessionId,
      createIfMissing: false,
    });

    res.json({
      ...response,
      sessionId: activeSessionId,
      history: afterReply.history,
      title: persistedConversation?.title || '',
      summary: persistedConversation?.summary || '',
      status: persistedConversation?.status || 'active',
      linkedResources: persistedConversation?.linkedResources || selectedResources.linkedResources || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getConversationMessages(req, res) {
  try {
    await enforceConversationRetention({ userId: req.user?.id || null });
    const conversation = await getConversation({
      userId: req.user?.id || null,
      sessionId: req.params.sessionId,
      createIfMissing: false,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    return res.json({
      success: true,
      sessionId: conversation.sessionId,
      title: conversation.title || '',
      summary: conversation.summary || '',
      status: conversation.status || 'active',
      archivedAt: conversation.archivedAt || null,
      linkedResources: conversation.linkedResources || [],
      history: conversation.history,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function listConversationSessions(req, res) {
  try {
    const requestedPage = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const search = String(req.query.q || '').trim();
    const status = String(req.query.status || 'active').trim();
    const userId = req.user?.id || null;
    await enforceConversationRetention({ userId });
    const filter = { userId, status: status === 'archived' ? 'archived' : 'active' };
    if (search) {
      filter.$or = [
        { sessionId: { $regex: escapeRegex(search), $options: 'i' } },
        { title: { $regex: escapeRegex(search), $options: 'i' } },
        { summary: { $regex: escapeRegex(search), $options: 'i' } },
        { lastMessagePreview: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const totalCount = await AIConversation.countDocuments(filter);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const currentPage = Math.min(requestedPage, totalPages);
    const hasPreviousPage = currentPage > 1;
    const hasNextPage = currentPage < totalPages;
    const skip = (currentPage - 1) * limit;

    const sessions = await AIConversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('sessionId title summary status linkedResources messageCount lastMessagePreview latestMessageRole latestMessageAt createdAt updatedAt')
      .lean();

    const items = sessions.map((session) => {
      return {
        sessionId: session.sessionId,
        title: session.title || '',
        summary: session.summary || '',
        status: session.status || 'active',
        linkedResourceCount: Array.isArray(session.linkedResources) ? session.linkedResources.length : 0,
        lastMessagePreview: session.lastMessagePreview || '',
        messageCount: Number.isFinite(session.messageCount) ? session.messageCount : 0,
        latestMessageRole: session.latestMessageRole || null,
        latestMessageAt: session.latestMessageAt instanceof Date
          ? session.latestMessageAt.toISOString()
          : (session.latestMessageAt || null),
        createdAt: session.createdAt instanceof Date
          ? session.createdAt.toISOString()
          : session.createdAt,
        updatedAt: session.updatedAt instanceof Date
          ? session.updatedAt.toISOString()
          : session.updatedAt,
      };
    });

    return res.json({
      success: true,
      totalCount,
      currentPage,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      query: search || undefined,
      status: filter.status,
      items,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function listLearningResources(req, res) {
  try {
    const items = await fetchResourcesForTutor({
      q: req.query.q,
      limit: req.query.limit,
    });
    return res.json({ success: true, items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateStudySession(req, res) {
  try {
    const updated = await updateConversationSession({
      userId: req.user?.id || null,
      sessionId: req.params.sessionId,
      title: req.body.title,
      status: req.body.status,
    });
    if (!updated) return res.status(404).json({ message: 'Conversation not found' });
    return res.json({ success: true, item: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function deleteStudySession(req, res) {
  try {
    const deleted = await deleteConversationSession({
      userId: req.user?.id || null,
      sessionId: req.params.sessionId,
    });
    if (!deleted) return res.status(404).json({ message: 'Conversation not found' });
    return res.json({ success: true, sessionId: req.params.sessionId, deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function resummarizeStudySessions(req, res) {
  try {
    const result = await runAiSessionMaintenance({
      inactiveDays: req.body.inactiveDays,
      limit: Math.min(Math.max(Number(req.body.limit) || 20, 1), 100),
      sessionId: req.body.sessionId,
      status: req.body.status,
      requestId: req.requestId || null,
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getTelemetryReport(req, res) {
  try {
    const result = await getAiTelemetryReport({
      range: req.query.range,
      endpoint: req.query.endpoint,
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function backfillConversationConsistency(req, res) {
  try {
    const result = await backfillAiConversationConsistency({
      sessionId: req.body.sessionId,
      limit: req.body.limit,
      dryRun: Boolean(req.body.dryRun),
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function aiHealth(_req, res) {
  res.json({
    status: 'ok',
    provider: process.env.AI_PROVIDER || 'mock',
    model: process.env.AI_MODEL || 'scaffold-v1',
  });
}

module.exports = {
  chatWithTutor,
  aiHealth,
  getConversationMessages,
  listConversationSessions,
  listLearningResources,
  updateStudySession,
  deleteStudySession,
  resummarizeStudySessions,
  getTelemetryReport,
  backfillConversationConsistency,
};
