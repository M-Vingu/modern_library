const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const AIGradeDraft = require('../models/AIGradeDraft');
const FinalGradeAudit = require('../models/FinalGradeAudit');
const { writeAuditLog } = require('../services/auditLogService');

function fail(res, status, code, message, details) {
  if (typeof res.fail === 'function') return res.fail(status, code, message, details);
  return res.status(status).json({ message, code, details });
}

function isTeacherOrAdmin(req) {
  return ['teacher', 'admin'].includes(req.user?.role);
}

async function createAssignment(req, res) {
  if (!isTeacherOrAdmin(req)) return fail(res, 403, 'ASSESSMENT_FORBIDDEN', 'Only teacher/admin can create assignments');
  try {
    const item = await Assignment.create({
      title: req.body.title,
      description: req.body.description,
      subject: req.body.subject,
      dueDate: req.body.dueDate,
      rubric: req.body.rubric,
      teacherId: req.user.id,
      status: req.body.status || 'published',
    });
    return res.status(201).json({ success: true, item });
  } catch (err) {
    return fail(res, 400, 'ASSESSMENT_ASSIGNMENT_CREATE_FAILED', err.message);
  }
}

async function submitAssignment(req, res) {
  if (!['student', 'admin'].includes(req.user?.role)) return fail(res, 403, 'ASSESSMENT_FORBIDDEN', 'Only student/admin can submit assignments');
  try {
    if (!mongoose.Types.ObjectId.isValid(req.body.assignmentId)) {
      return fail(res, 400, 'ASSESSMENT_ASSIGNMENT_INVALID', 'Invalid assignment id');
    }
    const assignment = await Assignment.findById(req.body.assignmentId);
    if (!assignment || assignment.status !== 'published') {
      return fail(res, 404, 'ASSESSMENT_ASSIGNMENT_NOT_FOUND', 'Assignment not available');
    }

    const item = await AssignmentSubmission.findOneAndUpdate(
      { assignmentId: assignment._id, studentId: req.user.id },
      {
        $set: {
          content: req.body.content,
          attachmentUrls: Array.isArray(req.body.attachmentUrls) ? req.body.attachmentUrls : [],
          status: 'submitted',
          submittedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return res.status(201).json({ success: true, item });
  } catch (err) {
    return fail(res, 400, 'ASSESSMENT_SUBMISSION_FAILED', err.message);
  }
}

async function aiGradeSubmission(req, res) {
  if (!isTeacherOrAdmin(req)) return fail(res, 403, 'ASSESSMENT_FORBIDDEN', 'Only teacher/admin can AI-grade submissions');
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ASSESSMENT_SUBMISSION_INVALID', 'Invalid submission id');

    const submission = await AssignmentSubmission.findById(id);
    if (!submission) return fail(res, 404, 'ASSESSMENT_SUBMISSION_NOT_FOUND', 'Submission not found');

    const score = Math.min(100, Math.max(0, Number(req.body.score ?? 75)));
    const draft = await AIGradeDraft.findOneAndUpdate(
      { submissionId: submission._id },
      {
        $set: {
          score,
          feedback: req.body.feedback || 'AI scaffold feedback: review this draft before final publishing.',
          rubricBreakdown: req.body.rubricBreakdown || {},
          model: process.env.AI_MODEL || 'scaffold-v1',
          generatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    submission.status = 'ai_drafted';
    await submission.save();

    await writeAuditLog(req, {
      action: 'assessment.ai_grade_drafted',
      targetType: 'submission',
      targetId: submission._id,
      metadata: { score },
    });

    return res.json({ success: true, draft });
  } catch (err) {
    return fail(res, 500, 'ASSESSMENT_AI_GRADE_FAILED', err.message);
  }
}

async function finalizeSubmission(req, res) {
  if (!isTeacherOrAdmin(req)) return fail(res, 403, 'ASSESSMENT_FORBIDDEN', 'Only teacher/admin can finalize grades');
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ASSESSMENT_SUBMISSION_INVALID', 'Invalid submission id');
    const submission = await AssignmentSubmission.findById(id);
    if (!submission) return fail(res, 404, 'ASSESSMENT_SUBMISSION_NOT_FOUND', 'Submission not found');

    const draft = await AIGradeDraft.findOne({ submissionId: submission._id });
    const finalScore = Number(req.body.finalScore);
    if (!Number.isFinite(finalScore)) return fail(res, 400, 'ASSESSMENT_FINAL_SCORE_REQUIRED', 'finalScore is required');

    const audit = await FinalGradeAudit.create({
      submissionId: submission._id,
      teacherId: req.user.id,
      previousScore: draft?.score,
      finalScore,
      overrideReason: req.body.overrideReason || 'Teacher finalized after review',
      finalizedAt: new Date(),
    });

    submission.finalScore = finalScore;
    submission.finalizedBy = req.user.id;
    submission.finalizedAt = new Date();
    submission.status = 'finalized';
    await submission.save();

    await writeAuditLog(req, {
      action: 'assessment.grade_finalized',
      targetType: 'submission',
      targetId: submission._id,
      metadata: { finalScore, previousScore: draft?.score, overrideReason: audit.overrideReason },
    });

    return res.json({ success: true, submission, audit });
  } catch (err) {
    return fail(res, 500, 'ASSESSMENT_FINALIZE_FAILED', err.message);
  }
}

async function getSubmissionById(req, res) {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ASSESSMENT_SUBMISSION_INVALID', 'Invalid submission id');

  const submission = await AssignmentSubmission.findById(id)
    .populate('studentId', 'name email role')
    .populate('assignmentId', 'title subject teacherId dueDate');
  if (!submission) return fail(res, 404, 'ASSESSMENT_SUBMISSION_NOT_FOUND', 'Submission not found');

  const draft = await AIGradeDraft.findOne({ submissionId: submission._id });
  const finalAudit = await FinalGradeAudit.findOne({ submissionId: submission._id }).sort({ finalizedAt: -1 });

  if (req.user.role === 'student' && submission.studentId._id.toString() !== req.user.id) {
    return fail(res, 403, 'ASSESSMENT_FORBIDDEN', 'Forbidden submission access');
  }

  return res.json({ success: true, submission, draft, finalAudit });
}

module.exports = {
  createAssignment,
  submitAssignment,
  aiGradeSubmission,
  finalizeSubmission,
  getSubmissionById,
};
