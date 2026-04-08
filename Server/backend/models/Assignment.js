const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  subject: { type: String, required: true, trim: true, index: true },
  dueDate: { type: Date, required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rubric: { type: Object },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'published', index: true },
}, { timestamps: true });

assignmentSchema.index({ teacherId: 1, createdAt: -1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
