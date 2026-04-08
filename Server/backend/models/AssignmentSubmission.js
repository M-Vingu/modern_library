const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true },
  attachmentUrls: [{ type: String, trim: true }],
  status: { type: String, enum: ['submitted', 'ai_drafted', 'finalized'], default: 'submitted', index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  finalScore: { type: Number, min: 0, max: 100 },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalizedAt: { type: Date },
}, { timestamps: true });

assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
