const mongoose = require('mongoose');

const aiResponseTelemetrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  anonymizedUserId: {
    type: String,
    trim: true,
    maxlength: 128,
    index: true,
  },
  sessionId: {
    type: String,
    required: false,
    index: true,
  },
  endpoint: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
    index: true,
  },
  requestId: {
    type: String,
    trim: true,
    maxlength: 120,
    index: true,
  },
  provider: {
    type: String,
    enum: ['openai', 'mock'],
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  promptVersion: {
    type: String,
    required: true,
    default: 'ai-tutor-rag-v1',
  },
  responseTimeMs: {
    type: Number,
    min: 0,
    required: true,
  },
  tokenUsage: {
    inputTokens: { type: Number, min: 0, default: 0 },
    outputTokens: { type: Number, min: 0, default: 0 },
    totalTokens: { type: Number, min: 0, default: 0 },
  },
  success: {
    type: Boolean,
    required: true,
  },
  fallbackUsed: {
    type: Boolean,
    default: false,
    index: true,
  },
  sessionStatus: {
    type: String,
    enum: ['active', 'archived', null],
    default: null,
  },
  messageCount: {
    type: Number,
    min: 0,
    default: 0,
  },
  errorMessage: {
    type: String,
    trim: true,
    maxlength: 500,
  },
}, { timestamps: true });

aiResponseTelemetrySchema.index({ sessionId: 1, createdAt: -1 });
aiResponseTelemetrySchema.index({ provider: 1, success: 1, createdAt: -1 });
aiResponseTelemetrySchema.index({ endpoint: 1, createdAt: -1 });
aiResponseTelemetrySchema.index({ promptVersion: 1, provider: 1, createdAt: -1 });

module.exports = mongoose.model('AIResponseTelemetry', aiResponseTelemetrySchema);
