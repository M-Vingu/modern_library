const test = require('node:test');
const assert = require('node:assert/strict');

const aiChatService = require('../services/aiChatService');
const aiConversationStore = require('../services/aiConversationStore');
const aiTelemetryService = require('../services/aiTelemetryService');
const aiSessionMaintenanceService = require('../services/aiSessionMaintenanceService');
const aiConversationConsistencyService = require('../services/aiConversationConsistencyService');
const AIConversation = require('../models/AIConversation');
const { createMockRes } = require('./testUtils');

function loadAiController() {
  const modulePath = require.resolve('../controllers/aiController');
  delete require.cache[modulePath];
  return require('../controllers/aiController');
}

test('chatWithTutor appends persisted conversation messages and returns history', async () => {
  const originalGetConversation = aiConversationStore.getConversation;
  const originalSeedConversationHistory = aiConversationStore.seedConversationHistory;
  const originalAppendConversationMessage = aiConversationStore.appendConversationMessage;
  const originalEnforceConversationRetention = aiConversationStore.enforceConversationRetention;
  const originalRecordAiTelemetry = aiTelemetryService.recordAiTelemetry;
  const originalGenerateChatReply = aiChatService.generateChatReply;

  const appended = [];

  aiConversationStore.getConversation = async () => ({
    sessionId: 'session-1',
    history: [],
  });
  aiConversationStore.seedConversationHistory = async () => ({
    sessionId: 'session-1',
    history: [],
  });
  aiConversationStore.enforceConversationRetention = async () => undefined;
  aiTelemetryService.recordAiTelemetry = async () => undefined;
  aiConversationStore.appendConversationMessage = async ({ role, content }) => {
    appended.push({ role, content });
    const history = appended.map((entry, index) => ({
      role: entry.role,
      content: entry.content,
      timestamp: `2026-04-24T08:00:0${index}.000Z`,
    }));
    return { sessionId: 'session-1', history };
  };
  aiChatService.generateChatReply = async ({ sessionId, history }) => ({
    provider: 'mock',
    reply: 'Here is a grounded answer.',
    guidance: ['Step 1', 'Step 2'],
    tone: 'supportive',
    grounded: true,
    resources: { books: [], courses: [], pastPapers: [] },
    sessionId,
    history,
    meta: { userId: 'user-1', model: 'scaffold-v2', resourceCounts: { books: 0, courses: 0, pastPapers: 0 } },
  });

  const req = {
    body: {
      message: 'Teach me binary search',
      context: { subject: 'Algorithms' },
      sessionId: 'session-1',
    },
    user: { id: 'user-1' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.chatWithTutor(req, res);

  aiConversationStore.getConversation = originalGetConversation;
  aiConversationStore.seedConversationHistory = originalSeedConversationHistory;
  aiConversationStore.enforceConversationRetention = originalEnforceConversationRetention;
  aiTelemetryService.recordAiTelemetry = originalRecordAiTelemetry;
  aiConversationStore.appendConversationMessage = originalAppendConversationMessage;
  aiChatService.generateChatReply = originalGenerateChatReply;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sessionId, 'session-1');
  assert.equal(res.body.history.length, 2);
  assert.equal(res.body.history[0].role, 'user');
  assert.equal(res.body.history[1].role, 'assistant');
});

test('getConversationMessages returns past messages for a session', async () => {
  const originalGetConversation = aiConversationStore.getConversation;
  const originalEnforceConversationRetention = aiConversationStore.enforceConversationRetention;

  aiConversationStore.enforceConversationRetention = async () => undefined;
  aiConversationStore.getConversation = async () => ({
    sessionId: 'session-2',
    title: 'Teach me calculus',
    summary: 'Started with: Teach me calculus | Latest reply: Start with limits.',
    status: 'active',
    archivedAt: null,
    history: [
      { role: 'user', content: 'Teach me calculus', timestamp: '2026-04-24T08:00:00.000Z' },
      { role: 'assistant', content: 'Start with limits.', timestamp: '2026-04-24T08:00:01.000Z' },
    ],
  });

  const req = {
    params: { sessionId: 'session-2' },
    user: { id: 'user-2' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.getConversationMessages(req, res);

  aiConversationStore.getConversation = originalGetConversation;
  aiConversationStore.enforceConversationRetention = originalEnforceConversationRetention;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.sessionId, 'session-2');
  assert.equal(res.body.title, 'Teach me calculus');
  assert.equal(res.body.status, 'active');
  assert.equal(res.body.history.length, 2);
});

test('listConversationSessions returns recent sessions with previews', async () => {
  const originalFind = AIConversation.find;
  const originalCountDocuments = AIConversation.countDocuments;
  const originalEnforceConversationRetention = aiConversationStore.enforceConversationRetention;
  const captured = {};

  aiConversationStore.enforceConversationRetention = async () => undefined;
  AIConversation.countDocuments = async (filter) => {
    captured.countFilter = filter;
    return 12;
  };
  AIConversation.find = (filter) => ({
    sort() {
      return this;
    },
    skip(value) {
      this._skip = value;
      return this;
    },
    limit(value) {
      this._limit = value;
      return this;
    },
    select() {
      return this;
    },
    async lean() {
      captured.findFilter = filter;
      return [
        {
          sessionId: 'session-new',
          title: 'Teach me graphs',
          summary: 'Started with: Teach me graphs | Latest reply: Start with vertices and edges.',
          messageCount: 2,
          lastMessagePreview: 'Start with vertices and edges.',
          latestMessageRole: 'assistant',
          latestMessageAt: new Date('2026-04-24T08:09:00.000Z'),
          createdAt: new Date('2026-04-24T08:00:00.000Z'),
          updatedAt: new Date('2026-04-24T08:10:00.000Z'),
        },
        {
          sessionId: 'session-old',
          title: 'Teach me calculus',
          summary: 'Started with: Teach me calculus',
          messageCount: 1,
          lastMessagePreview: 'Teach me calculus',
          latestMessageRole: 'user',
          latestMessageAt: new Date('2026-04-23T08:02:00.000Z'),
          createdAt: new Date('2026-04-23T08:00:00.000Z'),
          updatedAt: new Date('2026-04-23T08:05:00.000Z'),
        },
      ];
    },
  });

  const req = {
    user: { id: 'user-4' },
    query: { page: '20', limit: '2', q: 'graph' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.listConversationSessions(req, res);

  AIConversation.find = originalFind;
  AIConversation.countDocuments = originalCountDocuments;
  aiConversationStore.enforceConversationRetention = originalEnforceConversationRetention;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.totalCount, 12);
  assert.equal(res.body.currentPage, 6);
  assert.equal(res.body.totalPages, 6);
  assert.equal(res.body.hasNextPage, false);
  assert.equal(res.body.hasPreviousPage, true);
  assert.equal(res.body.query, 'graph');
  assert.equal(res.body.items.length, 2);
  assert.equal(res.body.items[0].sessionId, 'session-new');
  assert.equal(res.body.items[0].title, 'Teach me graphs');
  assert.equal(res.body.items[0].lastMessagePreview, 'Start with vertices and edges.');
  assert.equal(res.body.items[0].messageCount, 2);
  assert.equal(res.body.items[0].latestMessageRole, 'assistant');
  assert.equal(res.body.items[0].latestMessageAt, '2026-04-24T08:09:00.000Z');
  assert.equal(res.body.items[1].sessionId, 'session-old');
  assert.equal(res.body.items[1].title, 'Teach me calculus');
  assert.equal(res.body.items[1].messageCount, 1);
  assert.equal(res.body.items[1].latestMessageRole, 'user');
  assert.equal(res.body.items[1].latestMessageAt, '2026-04-23T08:02:00.000Z');
  assert.equal(captured.countFilter.userId, 'user-4');
  assert.equal(captured.countFilter.status, 'active');
  assert.match(String(captured.countFilter.$or[0].sessionId.$regex), /graph/i);
  assert.match(String(captured.countFilter.$or[1].title.$regex), /graph/i);
  assert.match(String(captured.countFilter.$or[2].summary.$regex), /graph/i);
  assert.match(String(captured.countFilter.$or[3].lastMessagePreview.$regex), /graph/i);
  assert.match(String(captured.findFilter.$or[0].sessionId.$regex), /graph/i);
  assert.match(String(captured.findFilter.$or[1].title.$regex), /graph/i);
  assert.match(String(captured.findFilter.$or[2].summary.$regex), /graph/i);
  assert.match(String(captured.findFilter.$or[3].lastMessagePreview.$regex), /graph/i);
});

test('updateStudySession updates saved study session metadata', async () => {
  const originalUpdateConversationSession = aiConversationStore.updateConversationSession;

  aiConversationStore.updateConversationSession = async () => ({
    sessionId: 'session-save',
    title: 'Binary Search Revision',
    status: 'archived',
    summary: 'Started with binary search practice.',
  });

  const req = {
    params: { sessionId: 'session-save' },
    body: { title: 'Binary Search Revision', status: 'archived' },
    user: { id: 'user-5' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.updateStudySession(req, res);

  aiConversationStore.updateConversationSession = originalUpdateConversationSession;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.item.title, 'Binary Search Revision');
  assert.equal(res.body.item.status, 'archived');
});

test('deleteStudySession removes a saved study session', async () => {
  const originalDeleteConversationSession = aiConversationStore.deleteConversationSession;

  aiConversationStore.deleteConversationSession = async () => true;

  const req = {
    params: { sessionId: 'session-delete' },
    user: { id: 'user-6' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.deleteStudySession(req, res);

  aiConversationStore.deleteConversationSession = originalDeleteConversationSession;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deleted, true);
  assert.equal(res.body.sessionId, 'session-delete');
});

test('listLearningResources returns grouped tutor resources', async () => {
  const learningResourceService = require('../services/learningResourceService');
  const originalFetchResourcesForTutor = learningResourceService.fetchResourcesForTutor;

  learningResourceService.fetchResourcesForTutor = async () => ({
    books: [{ resourceType: 'book', resourceId: 'book-1', title: 'OS Notes' }],
    courses: [{ resourceType: 'course', resourceId: 'course-1', title: 'Algorithms 101' }],
    pastPapers: [],
  });

  const req = {
    query: { q: 'algo', limit: '5' },
    user: { id: 'user-7' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.listLearningResources(req, res);

  learningResourceService.fetchResourcesForTutor = originalFetchResourcesForTutor;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.items.books.length, 1);
  assert.equal(res.body.items.courses.length, 1);
});

test('resummarizeStudySessions updates archived or inactive sessions', async () => {
  const originalRunAiSessionMaintenance = aiSessionMaintenanceService.runAiSessionMaintenance;
  aiSessionMaintenanceService.runAiSessionMaintenance = async () => ({
    success: true,
    processedCount: 1,
    updatedCount: 1,
    failedCount: 0,
    items: [{ sessionId: 'session-archived', status: 'archived', provider: 'mock', success: true }],
  });

  const req = {
    body: { status: 'archived', limit: 10 },
    user: { id: 'admin-1', role: 'admin' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.resummarizeStudySessions(req, res);

  aiSessionMaintenanceService.runAiSessionMaintenance = originalRunAiSessionMaintenance;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.updatedCount, 1);
  assert.equal(res.body.items[0].sessionId, 'session-archived');
});

test('getTelemetryReport returns analytics-ready telemetry aggregates', async () => {
  const originalGetAiTelemetryReport = aiTelemetryService.getAiTelemetryReport;

  aiTelemetryService.getAiTelemetryReport = async () => ({
    range: 'weekly',
    window: {
      from: '2026-04-24T00:00:00.000Z',
      to: '2026-05-01T00:00:00.000Z',
    },
    summary: {
      totalRequests: 12,
      successCount: 10,
      fallbackCount: 2,
      openAiCount: 7,
      mockCount: 5,
      avgResponseTimeMs: 880,
      avgTokensPerSession: 410,
      totalTokens: 4920,
    },
    endpointBreakdown: [
      { endpoint: 'ai.chat', requests: 10, successCount: 9, fallbackCount: 1, avgResponseTimeMs: 820, totalTokens: 4300 },
    ],
    providerTrend: [
      { bucket: '2026-04-30', provider: 'openai', requests: 4, fallbackCount: 0, avgResponseTimeMs: 760 },
      { bucket: '2026-04-30', provider: 'mock', requests: 2, fallbackCount: 2, avgResponseTimeMs: 120 },
    ],
  });

  const req = {
    query: { range: 'weekly' },
    user: { id: 'admin-2', role: 'admin' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.getTelemetryReport(req, res);

  aiTelemetryService.getAiTelemetryReport = originalGetAiTelemetryReport;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.range, 'weekly');
  assert.equal(res.body.summary.totalRequests, 12);
  assert.equal(res.body.endpointBreakdown[0].endpoint, 'ai.chat');
  assert.equal(res.body.providerTrend[0].provider, 'openai');
});

test('backfillConversationConsistency returns idempotent consistency results', async () => {
  const originalBackfillAiConversationConsistency = aiConversationConsistencyService.backfillAiConversationConsistency;

  aiConversationConsistencyService.backfillAiConversationConsistency = async () => ({
    scannedCount: 2,
    changedCount: 1,
    unchangedCount: 1,
    dryRun: true,
    items: [
      { sessionId: 'session-a', changed: true, fields: ['title', 'summary'] },
      { sessionId: 'session-b', changed: false, fields: [] },
    ],
  });

  const req = {
    body: { dryRun: true, limit: 10 },
    user: { id: 'admin-3', role: 'admin' },
  };
  const res = createMockRes();

  const aiController = loadAiController();
  await aiController.backfillConversationConsistency(req, res);

  aiConversationConsistencyService.backfillAiConversationConsistency = originalBackfillAiConversationConsistency;

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.changedCount, 1);
  assert.equal(res.body.items[0].fields[0], 'title');
});
