const test = require('node:test');
const assert = require('node:assert/strict');

const assessment = require('../controllers/assessmentController');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const AIGradeDraft = require('../models/AIGradeDraft');
const FinalGradeAudit = require('../models/FinalGradeAudit');

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

test('assessment: teacher finalize persists override reason and timestamp', async () => {
  const originalSubmissionFindById = AssignmentSubmission.findById;
  const originalDraftFindOne = AIGradeDraft.findOne;
  const originalAuditCreate = FinalGradeAudit.create;

  const saved = { called: false };
  AssignmentSubmission.findById = async () => ({
    _id: '507f1f77bcf86cd799439021',
    finalScore: null,
    status: 'ai_drafted',
    async save() { saved.called = true; },
  });
  AIGradeDraft.findOne = async () => ({ score: 73 });
  FinalGradeAudit.create = async (payload) => ({ ...payload, _id: 'audit-1' });

  const req = {
    params: { id: '507f1f77bcf86cd799439021' },
    body: { finalScore: 88, overrideReason: 'Teacher override after rubric review' },
    user: { id: '507f1f77bcf86cd799439099', role: 'teacher' },
  };
  const res = mockRes();

  await assessment.finalizeSubmission(req, res);

  AssignmentSubmission.findById = originalSubmissionFindById;
  AIGradeDraft.findOne = originalDraftFindOne;
  FinalGradeAudit.create = originalAuditCreate;

  assert.equal(res.statusCode, 200);
  assert.equal(saved.called, true);
  assert.equal(res.body.audit.overrideReason, 'Teacher override after rubric review');
  assert.ok(res.body.audit.finalizedAt);
});
