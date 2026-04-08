const test = require('node:test');
const assert = require('node:assert/strict');

const assessment = require('../controllers/assessmentController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    fail(status, code, message, details) {
      this.statusCode = status;
      this.body = { success: false, error: { code, message, details } };
      return this;
    },
  };
}

test('assessment: non-teacher cannot finalize grade', async () => {
  const req = {
    params: { id: '507f1f77bcf86cd799439011' },
    body: { finalScore: 80, overrideReason: 'ok' },
    user: { id: 'u1', role: 'student' },
  };
  const res = mockRes();

  await assessment.finalizeSubmission(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ASSESSMENT_FORBIDDEN');
});
