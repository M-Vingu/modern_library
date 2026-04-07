const test = require('node:test');
const assert = require('node:assert/strict');

const { getRealtimeConfig } = require('../controllers/liveClassroomController');

test('getRealtimeConfig falls back to default STUN server', () => {
  delete process.env.SOCKET_IO_PATH;
  delete process.env.WEBRTC_ICE_SERVERS_JSON;

  const res = {
    payload: null,
    json(body) {
      this.payload = body;
      return this;
    },
  };

  getRealtimeConfig({}, res);
  assert.equal(res.payload.socketPath, '/socket.io');
  assert.ok(Array.isArray(res.payload.iceServers));
  assert.equal(res.payload.iceServers[0].urls[0], 'stun:stun.l.google.com:19302');
});

test('getRealtimeConfig accepts JSON-defined ice servers', () => {
  process.env.SOCKET_IO_PATH = '/realtime';
  process.env.WEBRTC_ICE_SERVERS_JSON = JSON.stringify([
    { urls: ['turn:turn.example.com:3478'], username: 'u', credential: 'p' },
  ]);

  const res = {
    payload: null,
    json(body) {
      this.payload = body;
      return this;
    },
  };

  getRealtimeConfig({}, res);
  assert.equal(res.payload.socketPath, '/realtime');
  assert.equal(res.payload.iceServers[0].urls[0], 'turn:turn.example.com:3478');
});
