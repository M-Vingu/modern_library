const mongoose = require('mongoose');

const aiGradeDraftSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AssignmentSubmission', required: true, unique: true, index: true },
  model: { type: String, default: 'scaffold-v1' },
  score: { type: Number, min: 0, max: 100, required: true },
  feedback: { type: String, required: true },
  rubricBreakdown: { type: Object },
  generatedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = mongoose.model('AIGradeDraft', aiGradeDraftSchema);
