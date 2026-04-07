const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const LiveSession = require('../models/LiveSession');
const LiveClassroom = require('../models/LiveClassroom');
const ClassroomAttendance = require('../models/ClassroomAttendance');

const sessionPresence = new Map();
const userSockets = new Map();
let models = {
  LiveSession,
  LiveClassroom,
  ClassroomAttendance,
};

function safeAck(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function verifySocketJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) return null;

  const verifyOptions = { algorithms: ['HS256'] };
  if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;

  try {
    const decoded = jwt.verify(token, secret, verifyOptions);
    if (!decoded?.id) return null;
    return { userId: decoded.id.toString(), role: decoded.role || 'user' };
  } catch (_err) {
    return null;
  }
}

function getSocketToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return authToken;

  const headerToken = socket.handshake?.headers?.authorization;
  if (headerToken?.startsWith('Bearer ')) return headerToken.split(' ')[1];

  return null;
}

function roomForSession(sessionId) {
  return `live-session:${sessionId}`;
}

function canJoinClassroom(classroom, identity) {
  if (identity.role === 'admin') return true;
  if (classroom.visibility === 'public') return true;
  if (classroom.createdBy.toString() === identity.userId) return true;
  if (classroom.teacherIds.some((id) => id.toString() === identity.userId)) return true;
  if (classroom.learnerIds.some((id) => id.toString() === identity.userId)) return true;
  return false;
}

async function markAttendanceJoin({ session, classroom, userId }) {
  const isTeacher = classroom.teacherIds.some((id) => id.toString() === userId);
  const role = isTeacher ? 'teacher' : 'learner';
  const now = new Date();
  await models.ClassroomAttendance.findOneAndUpdate(
    { sessionId: session._id, userId },
    {
      $setOnInsert: {
        classroomId: classroom._id,
        role,
        joinedAt: now,
      },
      $set: { leftAt: null },
    },
    { upsert: true, returnDocument: 'after' },
  );
}

async function markAttendanceLeave({ sessionId, userId }) {
  const record = await models.ClassroomAttendance.findOne({ sessionId, userId });
  if (!record) return;

  const now = new Date();
  record.leftAt = now;
  const durationMs = Math.max(0, now.getTime() - new Date(record.joinedAt).getTime());
  record.durationSeconds = Math.floor(durationMs / 1000);
  await record.save();
}

function getOrCreateSet(map, key) {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
}

function attachPresence({ socket, sessionId }) {
  const socketIds = getOrCreateSet(sessionPresence, sessionId);
  socketIds.add(socket.id);
}

function detachPresence({ socket, sessionId }) {
  const socketIds = sessionPresence.get(sessionId);
  if (!socketIds) return 0;
  socketIds.delete(socket.id);
  if (socketIds.size === 0) sessionPresence.delete(sessionId);
  return socketIds.size;
}

function attachUserSocket(identity, socketId) {
  const set = getOrCreateSet(userSockets, identity.userId);
  set.add(socketId);
}

function detachUserSocket(identity, socketId) {
  const set = userSockets.get(identity.userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(identity.userId);
}

async function joinLiveSessionRoom(io, socket, payload, ack) {
  const sessionId = payload?.sessionId;
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return safeAck(ack, { ok: false, message: 'Valid sessionId is required' });
  }

  const identity = socket.data.identity;
  const session = await models.LiveSession.findById(sessionId);
  if (!session) return safeAck(ack, { ok: false, message: 'Session not found' });
  const classroom = await models.LiveClassroom.findById(session.classroomId);
  if (!classroom) return safeAck(ack, { ok: false, message: 'Classroom not found' });

  if (!canJoinClassroom(classroom, identity)) {
    return safeAck(ack, { ok: false, message: 'Forbidden' });
  }

  if (session.status === 'scheduled') {
    session.status = 'live';
    await session.save();
  }

  const room = roomForSession(sessionId);
  await socket.join(room);
  socket.data.sessionIds.add(sessionId);
  attachPresence({ socket, sessionId });
  await markAttendanceJoin({ session, classroom, userId: identity.userId });

  const activeParticipants = sessionPresence.get(sessionId)?.size || 1;
  io.to(room).emit('classroom:presence-updated', {
    sessionId,
    activeParticipants,
    userId: identity.userId,
    action: 'joined',
  });

  return safeAck(ack, {
    ok: true,
    sessionId,
    room,
    activeParticipants,
    meetingRoomId: session.meetingRoomId,
  });
}

async function leaveLiveSessionRoom(io, socket, payload, ack) {
  const sessionId = payload?.sessionId;
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return safeAck(ack, { ok: false, message: 'Valid sessionId is required' });
  }

  const room = roomForSession(sessionId);
  await socket.leave(room);
  socket.data.sessionIds.delete(sessionId);
  const activeParticipants = detachPresence({ socket, sessionId });
  await markAttendanceLeave({ sessionId, userId: socket.data.identity.userId });

  io.to(room).emit('classroom:presence-updated', {
    sessionId,
    activeParticipants,
    userId: socket.data.identity.userId,
    action: 'left',
  });

  safeAck(ack, { ok: true, sessionId, activeParticipants });
}

function relaySignal(io, socket, eventName, payload, ack) {
  const sessionId = payload?.sessionId;
  const targetUserId = payload?.targetUserId;
  const signal = payload?.signal;

  if (!sessionId || !targetUserId || !signal) {
    return safeAck(ack, { ok: false, message: 'sessionId, targetUserId and signal are required' });
  }
  if (!socket.data.sessionIds.has(sessionId)) {
    return safeAck(ack, { ok: false, message: 'Join session before signaling' });
  }

  const room = roomForSession(sessionId);
  const targetSocketIds = userSockets.get(targetUserId) || new Set();
  let delivered = 0;

  for (const socketId of targetSocketIds) {
    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) continue;
    if (!targetSocket.rooms.has(room)) continue;
    delivered += 1;
    targetSocket.emit(eventName, {
      sessionId,
      fromUserId: socket.data.identity.userId,
      signal,
      sentAt: new Date().toISOString(),
    });
  }

  return safeAck(ack, { ok: true, delivered });
}

function resetLiveClassroomSocketState() {
  sessionPresence.clear();
  userSockets.clear();
}

function initLiveClassroomSocketServer(server, { allowedOrigins, modelOverrides }) {
  models = {
    LiveSession,
    LiveClassroom,
    ClassroomAttendance,
    ...(modelOverrides || {}),
  };
  resetLiveClassroomSocketState();
  const socketPath = process.env.SOCKET_IO_PATH || '/socket.io';
  const io = new Server(server, {
    path: socketPath,
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = getSocketToken(socket);
    const identity = verifySocketJwt(token);
    if (!identity) return next(new Error('Unauthorized'));
    socket.data.identity = identity;
    socket.data.sessionIds = new Set();
    return next();
  });

  io.on('connection', (socket) => {
    const { identity } = socket.data;
    attachUserSocket(identity, socket.id);
    socket.emit('classroom:connected', { userId: identity.userId });

    socket.on('classroom:join-session', (payload, ack) => {
      joinLiveSessionRoom(io, socket, payload, ack).catch((err) => {
        safeAck(ack, { ok: false, message: err.message });
      });
    });

    socket.on('classroom:leave-session', (payload, ack) => {
      leaveLiveSessionRoom(io, socket, payload, ack).catch((err) => {
        safeAck(ack, { ok: false, message: err.message });
      });
    });

    socket.on('webrtc:offer', (payload, ack) => relaySignal(io, socket, 'webrtc:offer', payload, ack));
    socket.on('webrtc:answer', (payload, ack) => relaySignal(io, socket, 'webrtc:answer', payload, ack));
    socket.on('webrtc:ice-candidate', (payload, ack) => relaySignal(io, socket, 'webrtc:ice-candidate', payload, ack));

    socket.on('disconnect', () => {
      const sessionIds = Array.from(socket.data.sessionIds || []);
      detachUserSocket(identity, socket.id);

      sessionIds.forEach((sessionId) => {
        const room = roomForSession(sessionId);
        const activeParticipants = detachPresence({ socket, sessionId });
        io.to(room).emit('classroom:presence-updated', {
          sessionId,
          activeParticipants,
          userId: identity.userId,
          action: 'left',
        });
        markAttendanceLeave({ sessionId, userId: identity.userId }).catch(() => {});
      });
    });
  });

  return io;
}

module.exports = { initLiveClassroomSocketServer, resetLiveClassroomSocketState };
