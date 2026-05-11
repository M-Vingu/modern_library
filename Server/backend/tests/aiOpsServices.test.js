const test = require('node:test');
const assert = require('node:assert/strict');

const AIConversation = require('../models/AIConversation');
const AIResponseTelemetry = require('../models/AIResponseTelemetry');
const {
  buildConsistencyPatch,
  backfillAiConversationConsistency,
} = require('../services/aiConversationConsistencyService');
const {
  buildMaintenanceFilter,
  runAiSessionMaintenance,
} = require('../services/aiSessionMaintenanceService');
const { getAiTelemetryReport, anonymizeUserId } = require('../services/aiTelemetryService');

test('buildConsistencyPatch fills only missing AI conversation fields', () => {
  const patch = buildConsistencyPatch({
    sessionId: 'session-1',
    title: '',
    summary: '',
    status: undefined,
    messages: [
      { role: 'user', content: 'Teach me trees', timestamp: new Date('2026-04-25T08:00:00.000Z') },
      { role: 'assistant', content: 'Start with binary trees first.', timestamp: new Date('2026-04-25T08:05:00.000Z') },
    ],
  });

  assert.equal(patch.title, 'Teach me trees');
  assert.match(patch.summary, /Started with: Teach me trees/);
  assert.equal(patch.status, 'active');
  assert.equal(patch.messageCount, 2);
  assert.equal(patch.latestMessageRole, 'assistant');
});

test('backfillAiConversationConsistency is idempotent for already-valid sessions', async () => {
  const originalFind = AIConversation.find;

  AIConversation.find = () => ({
    sort() { return this; },
    limit() {
      return [
        {
          sessionId: 'session-valid',
          title: 'Valid title',
          summary: 'Valid summary',
          status: 'active',
          messageCount: 2,
          latestMessageRole: 'assistant',
          lastMessagePreview: 'Preview',
          lastActiveAt: new Date('2026-04-25T08:05:00.000Z'),
          latestMessageAt: new Date('2026-04-25T08:05:00.000Z'),
          createdAt: new Date('2026-04-25T08:00:00.000Z'),
          updatedAt: new Date('2026-04-25T08:05:00.000Z'),
          messages: [
            { role: 'user', content: 'Teach me trees', timestamp: new Date('2026-04-25T08:00:00.000Z') },
            { role: 'assistant', content: 'Start with binary trees first.', timestamp: new Date('2026-04-25T08:05:00.000Z') },
          ],
          async save() {
            throw new Error('should not save unchanged conversation');
          },
        },
      ];
    },
  });

  const result = await backfillAiConversationConsistency({ dryRun: false });
  AIConversation.find = originalFind;

  assert.equal(result.scannedCount, 1);
  assert.equal(result.changedCount, 0);
  assert.equal(result.items[0].changed, false);
});

test('buildMaintenanceFilter includes archived and inactive active sessions by default', () => {
  const filter = buildMaintenanceFilter({
    inactiveDays: 30,
    now: new Date('2026-05-01T00:00:00.000Z'),
  });

  assert.equal(Array.isArray(filter.$or), true);
  assert.equal(filter.$or[0].status, 'archived');
  assert.equal(filter.$or[1].status, 'active');
});

test('runAiSessionMaintenance archives inactive sessions and reports results', async () => {
  const originalFind = AIConversation.find;
  const aiSessionSummaryService = require('../services/aiSessionSummaryService');
  const originalSummarizeConversation = aiSessionSummaryService.summarizeConversation;

  aiSessionSummaryService.summarizeConversation = async () => ({
    title: 'Archived session',
    summary: 'Re-summarized session.',
    provider: 'mock',
    fallbackUsed: true,
  });

  const sessions = [
    {
      sessionId: 'session-maint-1',
      userId: 'user-1',
      status: 'active',
      title: '',
      summary: '',
      archivedAt: null,
      messages: [{ role: 'user', content: 'Help me revise calculus' }],
      async save() {
        return this;
      },
    },
  ];

  AIConversation.find = () => ({
    sort() { return this; },
    limit() { return sessions; },
  });

  const result = await runAiSessionMaintenance({ inactiveDays: 30, limit: 10 });

  AIConversation.find = originalFind;
  aiSessionSummaryService.summarizeConversation = originalSummarizeConversation;

  assert.equal(result.success, true);
  assert.equal(result.updatedCount, 1);
  assert.equal(result.items[0].sessionId, 'session-maint-1');
  assert.equal(result.items[0].status, 'archived');
});

test('getAiTelemetryReport returns summary, endpoint breakdown, and provider trends', async () => {
  const originalAggregate = AIResponseTelemetry.aggregate;
  let aggregateCall = 0;

  AIResponseTelemetry.aggregate = async () => {
    aggregateCall += 1;
    if (aggregateCall === 1) {
      return [{
        totalRequests: 6,
        successCount: 5,
        fallbackCount: 1,
        avgResponseTimeMs: 910,
        totalInputTokens: 200,
        totalOutputTokens: 400,
        totalTokens: 600,
      }];
    }
    if (aggregateCall === 2) {
      return [{
        _id: 'ai.chat',
        requests: 6,
        successCount: 5,
        fallbackCount: 1,
        avgResponseTimeMs: 910,
        totalTokens: 600,
      }];
    }
    if (aggregateCall === 3) {
      return [{ sessionCount: 3, avgTokensPerSession: 200 }];
    }
    return [
      { _id: { bucket: '2026-04-30', provider: 'openai' }, requests: 4, fallbackCount: 0, avgResponseTimeMs: 1000 },
      { _id: { bucket: '2026-04-30', provider: 'mock' }, requests: 2, fallbackCount: 1, avgResponseTimeMs: 120 },
    ];
  };

  const report = await getAiTelemetryReport({ range: 'weekly', endpoint: 'ai.chat' });
  AIResponseTelemetry.aggregate = originalAggregate;

  assert.equal(report.range, 'weekly');
  assert.equal(report.summary.totalRequests, 6);
  assert.equal(report.summary.avgTokensPerSession, 200);
  assert.equal(report.endpointBreakdown[0].endpoint, 'ai.chat');
  assert.equal(report.providerTrend[0].provider, 'openai');
});

test('anonymizeUserId produces a stable analytics-safe identifier', () => {
  const first = anonymizeUserId('user-123');
  const second = anonymizeUserId('user-123');

  assert.equal(first, second);
  assert.equal(first.length, 32);
});
