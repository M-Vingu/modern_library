const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  createAssignment,
  submitAssignment,
  aiGradeSubmission,
  finalizeSubmission,
  getSubmissionById,
} = require('../controllers/assessmentController');
const {
  createAssignmentSchema,
  submitAssignmentSchema,
  aiGradeSchema,
  finalizeSchema,
} = require('../validations/assessmentSchemas');

router.post('/assignments', protect, validateRequest(createAssignmentSchema), createAssignment);
router.post('/submissions', protect, validateRequest(submitAssignmentSchema), submitAssignment);
router.post('/submissions/:id/ai-grade', protect, validateRequest(aiGradeSchema), aiGradeSubmission);
router.patch('/submissions/:id/finalize', protect, validateRequest(finalizeSchema), finalizeSubmission);
router.get('/submissions/:id', protect, getSubmissionById);

module.exports = router;
