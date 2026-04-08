const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  liveClassroomCreateSchema,
  liveClassroomSessionCreateSchema,
  sessionIdParamSchema,
} = require('../validations/legacySchemas');
const {
  createClassroom,
  listClassrooms,
  getClassroomById,
  getRealtimeConfig,
  createClassroomSession,
  listClassroomSessions,
  joinLiveSession,
  leaveLiveSession,
  getSessionAttendance,
} = require('../controllers/liveClassroomController');

router.get('/', listClassrooms);
router.get('/realtime/config', protect, getRealtimeConfig);
router.get('/:id', getClassroomById);
router.post('/', protect, validateRequest(liveClassroomCreateSchema), createClassroom);
router.post('/:classroomId/sessions', protect, validateRequest(liveClassroomSessionCreateSchema), createClassroomSession);
router.get('/:classroomId/sessions', listClassroomSessions);
router.post('/sessions/:sessionId/join', protect, validateRequest(sessionIdParamSchema), joinLiveSession);
router.post('/sessions/:sessionId/leave', protect, validateRequest(sessionIdParamSchema), leaveLiveSession);
router.get('/sessions/:sessionId/attendance', protect, getSessionAttendance);

module.exports = router;
