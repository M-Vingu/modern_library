# Live Classroom Realtime (Socket.IO + WebRTC Signaling)

## Connection
- Socket endpoint: `SOCKET_IO_PATH` (default `/socket.io`)
- Auth: JWT token passed via:
  - `auth.token` in Socket.IO client options, or
  - `Authorization: Bearer <token>` header

## Flow
1. Call `POST /api/live-classrooms/sessions/:sessionId/join` to get session access metadata.
2. Connect to Socket.IO using JWT.
3. Emit `classroom:join-session` with `{ "sessionId": "<id>" }`.
4. Exchange WebRTC signals:
   - `webrtc:offer`
   - `webrtc:answer`
   - `webrtc:ice-candidate`
5. Emit `classroom:leave-session` when done.

## Events
- Server to client:
  - `classroom:connected` -> `{ userId }`
  - `classroom:presence-updated` -> `{ sessionId, activeParticipants, userId, action }`
  - `webrtc:offer` -> `{ sessionId, fromUserId, signal, sentAt }`
  - `webrtc:answer` -> `{ sessionId, fromUserId, signal, sentAt }`
  - `webrtc:ice-candidate` -> `{ sessionId, fromUserId, signal, sentAt }`
- Client to server:
  - `classroom:join-session` payload `{ sessionId }`
  - `classroom:leave-session` payload `{ sessionId }`
  - `classroom:moderation` payload `{ action, sessionId, targetUserId? }`
  - `webrtc:offer` payload `{ sessionId, targetUserId, signal }`
  - `webrtc:answer` payload `{ sessionId, targetUserId, signal }`
  - `webrtc:ice-candidate` payload `{ sessionId, targetUserId, signal }`

Each client event supports Socket.IO ACK with:
- success: `{ ok: true, ... }`
- failure: `{ ok: false, message }`

## Presence and Attendance
- Joining socket room upserts attendance with `leftAt: null`.
- Leaving/disconnect updates `leftAt` and `durationSeconds`.
- Session state moves from `scheduled` to `live` on first realtime join.
- Presence can be Redis-backed for multi-instance deployments (`REDIS_URL` configured).

## ICE Servers
- Configure via `WEBRTC_ICE_SERVERS_JSON`:
  - Example: `[{"urls":["stun:stun.l.google.com:19302"]}]`

## Signaling Rate Limits
- Configurable server-side anti-spam limits:
  - `SIGNAL_RATE_LIMIT_WINDOW_SEC`
  - `SIGNAL_RATE_LIMIT_PER_SOCKET`
  - `SIGNAL_RATE_LIMIT_PER_ROOM`

## Moderator Controls
- Supported actions (via `classroom:moderation`):
  - `lock_room`, `unlock_room`
  - `mute_user`, `unmute_user`
  - `remove_user`
- Room lock blocks new joins except host/admin/moderator.
- Muted users cannot publish WebRTC signaling events.
