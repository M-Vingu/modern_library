const mongoose = require('mongoose');

const classroomAttendanceSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveClassroom', required: true, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveSession', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['teacher', 'learner'], default: 'learner' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
  durationSeconds: { type: Number, min: 0, default: 0 },
}, { timestamps: true });

classroomAttendanceSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ClassroomAttendance', classroomAttendanceSchema);
