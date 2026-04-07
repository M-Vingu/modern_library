const test = require('node:test');
const assert = require('node:assert/strict');

const { createClassroom } = require('../controllers/liveClassroomController');
const { createMockRes } = require('./testUtils');

test('createClassroom validates title', async () => {
  const req = {
    user: { id: '507f1f77bcf86cd799439011', role: 'user' },
    body: { description: 'No title should fail' },
  };
  const res = createMockRes();

  await createClassroom(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'title is required');
});
