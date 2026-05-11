const test = require('node:test');
const assert = require('node:assert/strict');

const Book = require('../models/book');
const Course = require('../models/Course');
const PastPaper = require('../models/PastPaper');
const { generateChatReply } = require('../services/aiChatService');

function createLeanQuery(result, capture) {
  return {
    limit(value) {
      capture.limit = value;
      return this;
    },
    async lean() {
      return result;
    },
  };
}

async function withEnv(temp, fn) {
  const backup = {};
  const keys = Object.keys(temp);

  for (const key of keys) {
    backup[key] = process.env[key];
    process.env[key] = temp[key];
  }

  try {
    return await fn();
  } finally {
    for (const key of keys) {
      if (backup[key] === undefined) delete process.env[key];
      else process.env[key] = backup[key];
    }
  }
}

test('generateChatReply grounds responses in matching Modern Library resources', async () => {
  const originalBookFind = Book.find;
  const originalCourseFind = Course.find;
  const originalPastPaperFind = PastPaper.find;
  const calls = {};

  Book.find = (filter) => {
    calls.bookFilter = filter;
    return createLeanQuery([
      {
        _id: 'book-1',
        title: 'Binary Search Essentials',
        author: 'A. Teacher',
        genre: 'Algorithms',
        copies: 5,
      },
    ], calls);
  };

  Course.find = (filter) => {
    calls.courseFilter = filter;
    return createLeanQuery([
      {
        _id: 'course-1',
        title: 'Algorithms Bootcamp',
        description: 'Sorting, searching, and runtime analysis',
        instructor: 'Dr. Ada',
        price: { amount: 0, currency: 'KES' },
      },
    ], calls);
  };

  PastPaper.find = (filter) => {
    calls.pastPaperFilter = filter;
    return createLeanQuery([
      {
        _id: 'paper-1',
        title: 'Binary Search CAT 2025',
        course: 'Computer Science',
        subject: 'Algorithms',
        institution: 'Modern Library Institute',
        year: 2025,
        tags: ['binary-search', 'algorithms'],
        isVerified: true,
        visibility: 'public',
      },
    ], calls);
  };

  const result = await generateChatReply({
    message: 'Teach me binary search',
    context: { subject: 'Algorithms' },
    user: { id: 'user-1' },
  });

  Book.find = originalBookFind;
  Course.find = originalCourseFind;
  PastPaper.find = originalPastPaperFind;

  assert.equal(result.grounded, true);
  assert.equal(result.resources.books.length, 1);
  assert.equal(result.resources.courses.length, 1);
  assert.equal(result.resources.pastPapers.length, 1);
  assert.match(result.reply, /Algorithms Bootcamp|Binary Search Essentials|Binary Search CAT 2025/);
  assert.deepEqual(result.meta.resourceCounts, {
    books: 1,
    courses: 1,
    pastPapers: 1,
  });
  assert.equal(calls.pastPaperFilter.visibility, 'public');
});

test('generateChatReply falls back cleanly when no resources match', async () => {
  const originalBookFind = Book.find;
  const originalCourseFind = Course.find;
  const originalPastPaperFind = PastPaper.find;

  Book.find = () => createLeanQuery([], {});
  Course.find = () => createLeanQuery([], {});
  PastPaper.find = () => createLeanQuery([], {});

  const result = await generateChatReply({
    message: 'Help me study fluid mechanics',
    context: { subject: 'Engineering' },
    user: { id: 'user-2' },
  });

  Book.find = originalBookFind;
  Course.find = originalCourseFind;
  PastPaper.find = originalPastPaperFind;

  assert.equal(result.grounded, false);
  assert.equal(result.resources.books.length, 0);
  assert.equal(result.resources.courses.length, 0);
  assert.equal(result.resources.pastPapers.length, 0);
  assert.match(result.reply, /Engineering|fluid mechanics/i);
});

test('generateChatReply uses prior conversation history for follow-up questions', async () => {
  const originalBookFind = Book.find;
  const originalCourseFind = Course.find;
  const originalPastPaperFind = PastPaper.find;
  const calls = {};

  Book.find = (filter) => {
    calls.bookFilter = filter;
    return createLeanQuery([], {});
  };

  Course.find = () => createLeanQuery([], {});

  PastPaper.find = () => createLeanQuery([
    {
      _id: 'paper-2',
      title: 'Binary Search Revision Paper',
      course: 'Computer Science',
      subject: 'Algorithms',
      institution: 'Modern Library Institute',
      year: 2026,
      tags: ['binary-search'],
      isVerified: true,
      visibility: 'public',
    },
  ], {});

  const result = await generateChatReply({
    message: 'Give me a past paper too',
    context: {},
    history: [
      { role: 'user', content: 'Teach me binary search' },
      { role: 'assistant', content: 'Start with the basics of binary search.' },
    ],
    user: { id: 'user-3' },
    sessionId: 'session-follow-up',
  });

  Book.find = originalBookFind;
  Course.find = originalCourseFind;
  PastPaper.find = originalPastPaperFind;

  assert.equal(result.grounded, true);
  assert.equal(result.sessionId, 'session-follow-up');
  assert.equal(result.resources.pastPapers.length, 1);
  assert.match(String(calls.bookFilter.$or[0].title), /binary|paper/i);
  assert.match(result.reply, /Binary Search Revision Paper|your topic/i);
  assert.ok(result.meta.searchTerms.includes('binary'));
});

test('generateChatReply uses OpenAI when configured and preserves resources/history', async () => {
  const originalBookFind = Book.find;
  const originalCourseFind = Course.find;
  const originalPastPaperFind = PastPaper.find;
  const originalFetch = global.fetch;

  Book.find = () => createLeanQuery([
    {
      _id: 'book-1',
      title: 'Binary Search Essentials',
      author: 'A. Teacher',
      genre: 'Algorithms',
      copies: 5,
    },
  ], {});
  Course.find = () => createLeanQuery([], {});
  PastPaper.find = () => createLeanQuery([], {});

  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-5.4');
    assert.equal(Array.isArray(body.input), true);
    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            reply: 'Binary search works by halving a sorted search space until the target is found.',
            guidance: [
              'Review the invariant for left and right pointers.',
              'Trace one worked example on paper.',
              'Practice with a sorted array question.',
            ],
            tone: 'supportive',
            grounded: true,
          }),
        };
      },
    };
  };

  const result = await withEnv({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-5.4',
  }, async () => generateChatReply({
    message: 'Teach me binary search',
    context: { subject: 'Algorithms' },
    user: { id: 'user-openai' },
    history: [{ role: 'user', content: 'I am preparing for algorithms.' }],
    sessionId: 'session-openai',
  }));

  Book.find = originalBookFind;
  Course.find = originalCourseFind;
  PastPaper.find = originalPastPaperFind;
  global.fetch = originalFetch;

  assert.equal(result.provider, 'openai');
  assert.equal(result.sessionId, 'session-openai');
  assert.equal(result.resources.books.length, 1);
  assert.equal(result.guidance.length, 3);
  assert.match(result.reply, /halving a sorted search space/i);
});

test('generateChatReply falls back when OpenAI generation fails', async () => {
  const originalBookFind = Book.find;
  const originalCourseFind = Course.find;
  const originalPastPaperFind = PastPaper.find;
  const originalFetch = global.fetch;

  Book.find = () => createLeanQuery([], {});
  Course.find = () => createLeanQuery([], {});
  PastPaper.find = () => createLeanQuery([], {});
  global.fetch = async () => {
    throw new Error('network unavailable');
  };

  const result = await withEnv({
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-key',
    OPENAI_MODEL: 'gpt-5.4',
  }, async () => generateChatReply({
    message: 'Help me study calculus',
    context: { subject: 'Mathematics' },
    user: { id: 'user-fallback' },
  }));

  Book.find = originalBookFind;
  Course.find = originalCourseFind;
  PastPaper.find = originalPastPaperFind;
  global.fetch = originalFetch;

  assert.equal(result.provider, 'mock');
  assert.equal(result.grounded, false);
  assert.match(result.meta.note, /OpenAI generation failed/i);
});
