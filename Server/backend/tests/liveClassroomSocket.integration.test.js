const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

const {
  initLiveClassroomSocketServer,
  resetLiveClassroomSocketState,
} = require('../realtime/liveClassroomSocket');

const SESSION_ID = '64b64f5c9dd8a04c53f5a1a1';
const CLASSROOM_ID = '64b64f5c9dd8a04c53f5a1a2';
const OWNER_ID = '64b64f5c9dd8a04c53f5a1a3';
const TEACHER_ID = '64b64f5c9dd8a04c53f5a1a4';
const LEARNER_ID = '64b64f5c9dd8a04c53f5a1a5';
const OUTSIDER_ID = '64b64f5c9dd8a04c53f5a1a6';

function buildToken(userId, role = 'user') {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

function withTimeout(promise, ms = 2000, message = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function onceEvent(socket, eventName, predicate = () => true) {
  return new Promise((resolve) => {
    const handler = (payload) => {
      if (!predicate(payload)) return;
      socket.off(eventName, handler);
      resolve(payload);
    };
    socket.on(eventName, handler);
  });
}

function emitAck(socket, eventName, payload) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, (ack) => resolve(ack));
  });
}

function createModels() {
  const attendance = new Map();
  const session = {
    _id: SESSION_ID,
    classroomId: CLASSROOM_ID,
    status: 'scheduled',
    meetingRoomId: 'room-test-1',
    async save() {
      return this;
    },
  };
  const classroom = {
    _id: CLASSROOM_ID,
    createdBy: OWNER_ID,
    teacherIds: [TEACHER_ID],
    learnerIds: [LEARNER_ID],
    visibility: 'private',
  };

  return {
    LiveSession: {
      async findById(id) {
        return id === SESSION_ID ? session : null;
      },
    },
    LiveClassroom: {
      async findById(id) {
        return id === CLASSROOM_ID ? classroom : null;
      },
    },
    ClassroomAttendance: {
      async findOneAndUpdate(filter, update) {
        const key = `${filter.sessionId}:${filter.userId}`;
        const existing = attendance.get(key);
        const role = update.$setOnInsert?.role || 'learner';
        const joinedAt = update.$setOnInsert?.joinedAt || new Date();
        const next = existing || {
          classroomId: update.$setOnInsert?.classroomId,
          sessionId: filter.sessionId,
          userId: filter.userId,
          role,
          joinedAt,
          leftAt: null,
          durationSeconds: 0,
          async save() {
            attendance.set(key, this);
            return this;
          },
        };
        next.leftAt = null;
        attendance.set(key, next);
        return next;
      },
      async findOne(filter) {
        const key = `${filter.sessionId}:${filter.userId}`;
        return attendance.get(key) || null;
      },
    },
  };
}

async function bootstrapTestServer(modelOverrides) {
  const server = http.createServer();
  const io = initLiveClassroomSocketServer(server, {
    allowedOrigins: ['http://localhost:3000'],
    modelOverrides,
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;

  return {
    io,
    server,
    url,
    async close() {
      await new Promise((resolve) => io.close(resolve));
      await new Promise((resolve) => server.close(resolve));
      resetLiveClassroomSocketState();
    },
  };
}

test('socket rejects unauthorized connection', async () => {
  process.env.JWT_SECRET = 'test-secret-live-classroom';
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
  process.env.SOCKET_IO_PATH = '/socket.io';

  const models = createModels();
  const app = await bootstrapTestServer(models);
  const client = ioClient(app.url, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: false,
  });

  try {
    const connectErr = await withTimeout(new Promise((resolve) => {
      client.on('connect_error', (err) => resolve(err));
    }));
    assert.match(connectErr.message, /Unauthorized/i);
  } finally {
    client.close();
    await app.close();
  }
});

test('socket join/presence/signaling works end-to-end', async () => {
  process.env.JWT_SECRET = 'test-secret-live-classroom';
  delete process.env.JWT_ISSUER;
  delete process.env.JWT_AUDIENCE;
  process.env.SOCKET_IO_PATH = '/socket.io';

  const models = createModels();
  const app = await bootstrapTestServer(models);
  const teacher = ioClient(app.url, {
    path: '/socket.io',
    auth: { token: buildToken(TEACHER_ID, 'user') },
    transports: ['websocket'],
    reconnection: false,
  });
  const learner = ioClient(app.url, {
    path: '/socket.io',
    auth: { token: buildToken(LEARNER_ID, 'user') },
    transports: ['websocket'],
    reconnection: false,
  });
  const outsider = ioClient(app.url, {
    path: '/socket.io',
    auth: { token: buildToken(OUTSIDER_ID, 'user') },
    transports: ['websocket'],
    reconnection: false,
  });

  try {
    await withTimeout(Promise.all([
      onceEvent(teacher, 'connect'),
      onceEvent(learner, 'connect'),
      onceEvent(outsider, 'connect'),
    ]));

    const teacherJoin = await emitAck(teacher, 'classroom:join-session', { sessionId: SESSION_ID });
    assert.equal(teacherJoin.ok, true);
    assert.equal(teacherJoin.activeParticipants, 1);

    const teacherPresence = onceEvent(
      teacher,
      'classroom:presence-updated',
      (event) => event.action === 'joined' && event.userId === LEARNER_ID,
    );
    const learnerJoin = await emitAck(learner, 'classroom:join-session', { sessionId: SESSION_ID });
    assert.equal(learnerJoin.ok, true);
    assert.equal(learnerJoin.activeParticipants, 2);

    const presencePayload = await withTimeout(teacherPresence);
    assert.equal(presencePayload.sessionId, SESSION_ID);
    assert.equal(presencePayload.activeParticipants, 2);

    const offerPayloadPromise = onceEvent(learner, 'webrtc:offer');
    const offerAck = await emitAck(teacher, 'webrtc:offer', {
      sessionId: SESSION_ID,
      targetUserId: LEARNER_ID,
      signal: { sdp: 'mock-offer-sdp', type: 'offer' },
    });
    assert.equal(offerAck.ok, true);
    assert.equal(offerAck.delivered, 1);

    const offerPayload = await withTimeout(offerPayloadPromise);
    assert.equal(offerPayload.fromUserId, TEACHER_ID);
    assert.equal(offerPayload.sessionId, SESSION_ID);
    assert.equal(offerPayload.signal.type, 'offer');

    const forbiddenJoin = await emitAck(outsider, 'classroom:join-session', { sessionId: SESSION_ID });
    assert.equal(forbiddenJoin.ok, false);
    assert.match(forbiddenJoin.message, /Forbidden/i);
  } finally {
    teacher.close();
    learner.close();
    outsider.close();
    await app.close();
  }
});
