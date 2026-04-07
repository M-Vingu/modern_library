const mongoose = require('mongoose');

const liveClassroomSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  subject: { type: String, trim: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  learnerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  accessCode: { type: String, trim: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
}, { timestamps: true });

module.exports = mongoose.model('LiveClassroom', liveClassroomSchema);
