const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  chatWithTutor,
  aiHealth,
  getConversationMessages,
  listConversationSessions,
  listLearningResources,
  updateStudySession,
  deleteStudySession,
  resummarizeStudySessions,
  getTelemetryReport,
  backfillConversationConsistency,
} = require('../controllers/aiController');
const {
  aiChatSchema,
  aiConversationHistorySchema,
  aiConversationListSchema,
} = require('../validations/aiSchemas');
const {
  aiConversationListAdvancedSchema,
  aiConversationBackfillSchema,
  aiResourceListSchema,
  aiResummarizeSchema,
  aiTelemetryReportSchema,
  aiSessionDeleteSchema,
  aiSessionUpdateSchema,
} = require('../validations/aiSessionSchemas');
const { authorizeRoles } = require('../middleware/roleMiddleware');

router.get('/health', aiHealth);
router.get('/resources', protect, validateRequest(aiResourceListSchema), listLearningResources);
router.get('/conversations', protect, validateRequest(aiConversationListAdvancedSchema), listConversationSessions);
router.get('/conversations/:sessionId', protect, validateRequest(aiConversationHistorySchema), getConversationMessages);
router.get('/telemetry/report', protect, authorizeRoles('admin'), validateRequest(aiTelemetryReportSchema), getTelemetryReport);
router.patch('/conversations/:sessionId', protect, validateRequest(aiSessionUpdateSchema), updateStudySession);
router.delete('/conversations/:sessionId', protect, validateRequest(aiSessionDeleteSchema), deleteStudySession);
router.post('/admin/resummarize', protect, authorizeRoles('admin'), validateRequest(aiResummarizeSchema), resummarizeStudySessions);
router.post('/admin/backfill-conversations', protect, authorizeRoles('admin'), validateRequest(aiConversationBackfillSchema), backfillConversationConsistency);
router.post('/chat', protect, validateRequest(aiChatSchema), chatWithTutor);

module.exports = router;
