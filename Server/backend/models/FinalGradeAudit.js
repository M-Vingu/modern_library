const mongoose = require('mongoose');

const finalGradeAuditSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentSubmission', required: true, index: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  previousScore: { type: Number, min: 0, max: 100 },
  finalScore: { type: Number, min: 0, max: 100, required: true },
  overrideReason: { type: String, trim: true, required: true },
  finalizedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

finalGradeAuditSchema.index({ submissionId: 1, finalizedAt: -1 });

module.exports = mongoose.model('FinalGradeAudit', finalGradeAuditSchema);
