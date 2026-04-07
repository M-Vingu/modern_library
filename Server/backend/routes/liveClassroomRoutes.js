const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
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
router.post('/', protect, createClassroom);
router.post('/:classroomId/sessions', protect, createClassroomSession);
router.get('/:classroomId/sessions', listClassroomSessions);
router.post('/sessions/:sessionId/join', protect, joinLiveSession);
router.post('/sessions/:sessionId/leave', protect, leaveLiveSession);
router.get('/sessions/:sessionId/attendance', protect, getSessionAttendance);

module.exports = router;
