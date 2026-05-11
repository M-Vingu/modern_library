const mongoose = require('mongoose');

const aiConversationMessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 4000,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const aiConversationResourceSchema = new mongoose.Schema({
  resourceType: {
    type: String,
    enum: ['book', 'course', 'past_paper'],
    required: true,
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  label: {
    type: String,
    trim: true,
    required: true,
    maxlength: 160,
  },
}, { _id: false });

const aiConversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    trim: true,
  },
  messages: {
    type: [aiConversationMessageSchema],
    default: [],
  },
  linkedResources: {
    type: [aiConversationResourceSchema],
    default: [],
  },
  title: {
    type: String,
    trim: true,
    default: '',
    maxlength: 80,
  },
  summary: {
    type: String,
    trim: true,
    default: '',
    maxlength: 240,
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
    index: true,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
  lastActiveAt: {
    type: Date,
    default: null,
  },
  messageCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastMessagePreview: {
    type: String,
    trim: true,
    default: '',
    maxlength: 160,
  },
  latestMessageRole: {
    type: String,
    enum: ['user', 'assistant', 'system', null],
    default: null,
  },
  latestMessageAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

aiConversationSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
aiConversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });
aiConversationSchema.index({ userId: 1, latestMessageAt: -1 });
aiConversationSchema.index({ userId: 1, lastMessagePreview: 'text' });
aiConversationSchema.index({ userId: 1, 'linkedResources.resourceType': 1, 'linkedResources.resourceId': 1 });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
