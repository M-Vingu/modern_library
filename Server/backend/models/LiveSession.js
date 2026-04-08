const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveClassroom', required: true, index: true },
  hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  scheduledAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, min: 5, max: 600, default: 60 },
  status: { type: String, enum: ['scheduled', 'live', 'ended', 'cancelled'], default: 'scheduled', index: true },
  provider: { type: String, enum: ['jitsi', 'zoom', 'custom'], default: 'jitsi' },
  meetingRoomId: { type: String, trim: true },
  recordingUrl: { type: String, trim: true },
  roomLocked: { type: Boolean, default: false, index: true },
  mutedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

module.exports = mongoose.model('LiveSession', liveSessionSchema);
