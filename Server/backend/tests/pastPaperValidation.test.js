const test = require('node:test');
const assert = require('node:assert/strict');

const { createPastPaper } = require('../controllers/pastPaperController');
const { createMockRes } = require('./testUtils');

test('createPastPaper validates required fields', async () => {
  const req = {
    user: { id: '507f1f77bcf86cd799439011', role: 'user' },
    body: {
      institution: 'TVET',
      course: 'Engineering',
      subject: 'Math',
      year: 2025,
      fileUrl: 'https://example.com/paper.pdf',
    },
  };
  const res = createMockRes();

  await createPastPaper(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Missing required fields');
});
