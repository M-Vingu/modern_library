const test = require('node:test');
const assert = require('node:assert/strict');

const AIConversation = require('../models/AIConversation');
const {
  appendConversationMessage,
  buildConversationSummary,
  buildConversationTitle,
  enforceConversationRetention,
  getConversation,
  seedConversationHistory,
} = require('../services/aiConversationStore');

test('conversation store persists isolated history per user and session', async () => {
  const originalFindOne = AIConversation.findOne;
  const originalCreate = AIConversation.create;

  const store = new Map();

  AIConversation.findOne = async ({ userId, sessionId }) => (
    store.get(`${userId}:${sessionId}`) || null
  );
  AIConversation.create = async ({ userId, sessionId, messages }) => {
    const doc = {
      userId,
      sessionId,
      messages: messages || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      async save() {
        this.updatedAt = new Date();
        store.set(`${this.userId}:${this.sessionId}`, this);
        return this;
      },
    };
    store.set(`${userId}:${sessionId}`, doc);
    return doc;
  };

  const first = await getConversation({ userId: 'user-1', sessionId: 'session-a' });
  await appendConversationMessage({
    userId: 'user-1',
    sessionId: first.sessionId,
    role: 'user',
    content: 'Teach me binary search',
  });

  const second = await getConversation({ userId: 'user-1', sessionId: 'session-b' });
  await appendConversationMessage({
    userId: 'user-1',
    sessionId: second.sessionId,
    role: 'user',
    content: 'Teach me calculus',
  });

  const firstConversation = await getConversation({ userId: 'user-1', sessionId: 'session-a' });
  const secondConversation = await getConversation({ userId: 'user-1', sessionId: 'session-b' });

  AIConversation.findOne = originalFindOne;
  AIConversation.create = originalCreate;

  assert.equal(firstConversation.history.length, 1);
  assert.equal(firstConversation.history[0].content, 'Teach me binary search');
  assert.equal(secondConversation.history.length, 1);
  assert.equal(secondConversation.history[0].content, 'Teach me calculus');
});

test('conversation store seeds a conversation once from client-provided history', async () => {
  const originalFindOne = AIConversation.findOne;
  const originalCreate = AIConversation.create;

  const store = new Map();

  AIConversation.findOne = async ({ userId, sessionId }) => (
    store.get(`${userId}:${sessionId}`) || null
  );
  AIConversation.create = async ({ userId, sessionId, messages }) => {
    const doc = {
      userId,
      sessionId,
      messages: messages || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      async save() {
        this.updatedAt = new Date();
        store.set(`${this.userId}:${this.sessionId}`, this);
        return this;
      },
    };
    store.set(`${userId}:${sessionId}`, doc);
    return doc;
  };

  await seedConversationHistory({
    userId: 'user-2',
    sessionId: 'session-seeded',
    history: [
      { role: 'user', content: 'I am studying algorithms' },
      { role: 'assistant', content: 'Start with binary search' },
    ],
  });

  const conversation = await getConversation({ userId: 'user-2', sessionId: 'session-seeded' });

  AIConversation.findOne = originalFindOne;
  AIConversation.create = originalCreate;

  assert.equal(conversation.history.length, 2);
  assert.equal(conversation.history[0].content, 'I am studying algorithms');
});

test('buildConversationSummary derives preview and latest message metadata', () => {
  const summary = buildConversationSummary([
    { role: 'user', content: 'Teach me binary search', timestamp: new Date('2026-04-24T08:00:00.000Z') },
    { role: 'assistant', content: 'Start with the concept of a sorted array.', timestamp: new Date('2026-04-24T08:05:00.000Z') },
  ]);

  assert.equal(summary.title, 'Teach me binary search');
  assert.match(summary.summary, /Started with: Teach me binary search/);
  assert.equal(summary.messageCount, 2);
  assert.equal(summary.lastMessagePreview, 'Start with the concept of a sorted array.');
  assert.equal(summary.latestMessageRole, 'assistant');
  assert.equal(summary.latestMessageAt.toISOString(), '2026-04-24T08:05:00.000Z');
});

test('buildConversationTitle uses the first user message', () => {
  const title = buildConversationTitle([
    { role: 'system', content: 'System prompt' },
    { role: 'user', content: 'Help me revise operating systems before finals' },
    { role: 'assistant', content: 'Let us start with processes and threads.' },
  ]);

  assert.equal(title, 'Help me revise operating systems before finals');
});

test('enforceConversationRetention archives inactive conversations and deletes expired archived ones', async () => {
  const originalUpdateMany = AIConversation.updateMany;
  const originalDeleteMany = AIConversation.deleteMany;
  const calls = [];

  AIConversation.updateMany = async (filter, update) => {
    calls.push({ type: 'updateMany', filter, update });
    return { acknowledged: true };
  };
  AIConversation.deleteMany = async (filter) => {
    calls.push({ type: 'deleteMany', filter });
    return { acknowledged: true };
  };

  await enforceConversationRetention({ userId: 'user-9' });

  AIConversation.updateMany = originalUpdateMany;
  AIConversation.deleteMany = originalDeleteMany;

  assert.equal(calls[0].type, 'updateMany');
  assert.equal(calls[0].filter.userId, 'user-9');
  assert.equal(calls[0].filter.status, 'active');
  assert.equal(calls[1].type, 'deleteMany');
  assert.equal(calls[1].filter.userId, 'user-9');
  assert.equal(calls[1].filter.status, 'archived');
});
