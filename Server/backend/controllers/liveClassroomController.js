const mongoose = require('mongoose');
const crypto = require('crypto');
const LiveClassroom = require('../models/LiveClassroom');
const LiveSession = require('../models/LiveSession');
const ClassroomAttendance = require('../models/ClassroomAttendance');
const { generateClassroomToken } = require('../services/pastPaperStorageService');

function isAdmin(req) {
  return req.user?.role === 'admin';
}

function canAccessClassroom(classroom, req) {
  if (isAdmin(req)) return true;
  if (classroom.visibility === 'public') return true;
  if (classroom.createdBy.toString() === req.user.id) return true;
  if (classroom.teacherIds.some((id) => id.toString() === req.user.id)) return true;
  if (classroom.learnerIds.some((id) => id.toString() === req.user.id)) return true;
  return false;
}

function buildRoomId(sessionId) {
  return `class-${sessionId}-${crypto.randomBytes(4).toString('hex')}`;
}

async function createClassroom(req, res) {
  try {
    const { title, description, subject, teacherIds, learnerIds, visibility, accessCode } = req.body;
    if (!title) return res.status(400).json({ message: 'title is required' });

    const classroom = await LiveClassroom.create({
      title,
      description,
      subject,
      createdBy: req.user.id,
      teacherIds: Array.isArray(teacherIds) ? teacherIds : [req.user.id],
      learnerIds: Array.isArray(learnerIds) ? learnerIds : [],
      visibility: visibility || 'private',
      accessCode: accessCode || null,
      status: 'active',
    });
    res.status(201).json(classroom);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listClassrooms(req, res) {
  try {
    const { q, subject, status = 'active', page = 1, limit = 20 } = req.query;
    const filter = { status };
    if (q) filter.title = new RegExp(q, 'i');
    if (subject) filter.subject = new RegExp(subject, 'i');

    const safeLimit = Math.min(Number(limit) || 20, 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const items = await LiveClassroom.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('createdBy', 'name email');
    const total = await LiveClassroom.countDocuments(filter);
    res.json({ page: safePage, limit: safeLimit, total, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getClassroomById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid classroom id' });
    }
    const classroom = await LiveClassroom.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('teacherIds', 'name email');
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });
    res.json(classroom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createClassroomSession(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.classroomId)) {
      return res.status(400).json({ message: 'Invalid classroom id' });
    }

    const classroom = await LiveClassroom.findById(req.params.classroomId);
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    const ownsClassroom = classroom.createdBy.toString() === req.user.id;
    const isTeacher = classroom.teacherIds.some((id) => id.toString() === req.user.id);
    if (!isAdmin(req) && !ownsClassroom && !isTeacher) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { title, scheduledAt, durationMinutes, provider } = req.body;
    if (!title || !scheduledAt) return res.status(400).json({ message: 'title and scheduledAt are required' });

    const session = await LiveSession.create({
      classroomId: classroom._id,
      hostUserId: req.user.id,
      title,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: Number(durationMinutes) || 60,
      provider: provider || 'jitsi',
      meetingRoomId: buildRoomId(classroom._id.toString()),
      status: 'scheduled',
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listClassroomSessions(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.classroomId)) {
      return res.status(400).json({ message: 'Invalid classroom id' });
    }
    const items = await LiveSession.find({ classroomId: req.params.classroomId }).sort({ scheduledAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function joinLiveSession(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session id' });
    }
    const session = await LiveSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Live session not found' });

    const classroom = await LiveClassroom.findById(session.classroomId);
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });
    if (!canAccessClassroom(classroom, req)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const isTeacher = classroom.teacherIds.some((id) => id.toString() === req.user.id);
    const role = isTeacher ? 'teacher' : 'learner';

    const now = new Date();
    await ClassroomAttendance.findOneAndUpdate(
      { sessionId: session._id, userId: req.user.id },
      {
        $setOnInsert: {
          classroomId: classroom._id,
          joinedAt: now,
          role,
        },
        $set: { leftAt: null },
      },
      { upsert: true, returnDocument: 'after' },
    );

    const accessToken = generateClassroomToken({
      sessionId: session._id.toString(),
      userId: req.user.id,
      role,
    });

    const roomJoinUrl = `${process.env.LIVE_CLASSROOM_JOIN_BASE_URL || 'https://meet.jit.si'}/${session.meetingRoomId}`;
    res.json({
      message: 'Joined live session',
      accessToken,
      roomJoinUrl,
      sessionId: session._id,
      role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function leaveLiveSession(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session id' });
    }

    const record = await ClassroomAttendance.findOne({ sessionId: req.params.sessionId, userId: req.user.id });
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    const now = new Date();
    record.leftAt = now;
    const durationMs = Math.max(0, now.getTime() - new Date(record.joinedAt).getTime());
    record.durationSeconds = Math.floor(durationMs / 1000);
    await record.save();

    res.json({ message: 'Left session', durationSeconds: record.durationSeconds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getSessionAttendance(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
      return res.status(400).json({ message: 'Invalid session id' });
    }
    const session = await LiveSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const classroom = await LiveClassroom.findById(session.classroomId);
    if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

    const ownsClassroom = classroom.createdBy.toString() === req.user.id;
    const isTeacher = classroom.teacherIds.some((id) => id.toString() === req.user.id);
    if (!isAdmin(req) && !ownsClassroom && !isTeacher) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const items = await ClassroomAttendance.find({ sessionId: session._id })
      .populate('userId', 'name email')
      .sort({ joinedAt: 1 });

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function getRealtimeConfig(_req, res) {
  const rawIceServers = process.env.WEBRTC_ICE_SERVERS_JSON;
  let iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];

  if (rawIceServers) {
    try {
      const parsed = JSON.parse(rawIceServers);
      if (Array.isArray(parsed) && parsed.length > 0) iceServers = parsed;
    } catch (_err) {
      // Fall back to default STUN if env value is malformed.
    }
  }

  res.json({
    socketPath: process.env.SOCKET_IO_PATH || '/socket.io',
    events: {
      connect: 'classroom:connected',
      join: 'classroom:join-session',
      leave: 'classroom:leave-session',
      presence: 'classroom:presence-updated',
      offer: 'webrtc:offer',
      answer: 'webrtc:answer',
      iceCandidate: 'webrtc:ice-candidate',
    },
    iceServers,
  });
}

module.exports = {
  createClassroom,
  listClassrooms,
  getClassroomById,
  getRealtimeConfig,
  createClassroomSession,
  listClassroomSessions,
  joinLiveSession,
  leaveLiveSession,
  getSessionAttendance,
};
