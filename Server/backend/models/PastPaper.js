const mongoose = require('mongoose');

const pastPaperSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  institution: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true },
  unitCode: { type: String, trim: true },
  subject: { type: String, required: true, trim: true },
  year: { type: Number, min: 1990, max: 2100, required: true },
  examType: {
    type: String,
    enum: ['cat', 'midterm', 'endterm', 'national', 'mock', 'other'],
    default: 'other',
  },
  semester: { type: String, trim: true },
  level: { type: String, trim: true },
  tags: [{ type: String, trim: true }],
  fileUrl: { type: String, trim: true },
  storageProvider: { type: String, enum: ['local', 's3', 'cloudinary', 'external'], default: 'local' },
  fileKey: { type: String, trim: true },
  mimeType: { type: String, trim: true },
  fileSize: { type: Number, min: 0 },
  originalFileName: { type: String, trim: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isVerified: { type: Boolean, default: false },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  downloadCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

pastPaperSchema.index({
  title: 'text',
  institution: 'text',
  course: 'text',
  subject: 'text',
  tags: 'text',
});

module.exports = mongoose.model('PastPaper', pastPaperSchema);
