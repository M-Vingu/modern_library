const AIResponseTelemetry = require('../models/AIResponseTelemetry');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

function anonymizeUserId(userId) {
  if (!userId) return null;
  const salt = String(process.env.AI_TELEMETRY_HASH_SALT || 'modern-library-ai-telemetry').trim();
  return crypto.createHash('sha256').update(`${salt}:${userId}`).digest('hex').slice(0, 32);
}

function getRangeWindow(range = 'daily', now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);

  if (range === 'monthly') start.setDate(start.getDate() - 30);
  else if (range === 'weekly') start.setDate(start.getDate() - 7);
  else start.setDate(start.getDate() - 1);

  return { start, end };
}

function getTrendDateFormat(range = 'daily') {
  return range === 'daily' ? '%Y-%m-%dT%H:00:00.000Z' : '%Y-%m-%d';
}

async function recordAiTelemetry({
  userId,
  sessionId,
  endpoint,
  requestId,
  provider,
  model,
  promptVersion,
  responseTimeMs,
  tokenUsage,
  success,
  fallbackUsed,
  sessionStatus,
  messageCount,
  errorMessage,
}) {
  const payload = {
    userId,
    anonymizedUserId: anonymizeUserId(userId),
    sessionId,
    endpoint: endpoint || 'ai.chat',
    requestId: requestId || undefined,
    provider: provider || 'mock',
    model: model || 'scaffold-v2',
    promptVersion: promptVersion || 'ai-tutor-rag-v1',
    responseTimeMs: Number(responseTimeMs) || 0,
    tokenUsage: {
      inputTokens: Number(tokenUsage?.inputTokens) || 0,
      outputTokens: Number(tokenUsage?.outputTokens) || 0,
      totalTokens: Number(tokenUsage?.totalTokens) || 0,
    },
    success: Boolean(success),
    fallbackUsed: Boolean(fallbackUsed),
    sessionStatus: sessionStatus || null,
    messageCount: Number(messageCount) || 0,
    errorMessage: errorMessage || undefined,
  };

  logger.info({
    type: 'ai_request_telemetry',
    endpoint: payload.endpoint,
    requestId: payload.requestId,
    sessionId: payload.sessionId,
    anonymizedUserId: payload.anonymizedUserId,
    provider: payload.provider,
    model: payload.model,
    promptVersion: payload.promptVersion,
    responseTimeMs: payload.responseTimeMs,
    success: payload.success,
    fallbackUsed: payload.fallbackUsed,
    tokenUsage: payload.tokenUsage,
  }, 'ai_request_telemetry');

  return AIResponseTelemetry.create(payload);
}

async function getAiTelemetryReport({
  range = 'daily',
  endpoint,
  from,
  to,
} = {}) {
  const window = getRangeWindow(range);
  const start = from ? new Date(from) : window.start;
  const end = to ? new Date(to) : window.end;
  const dateFilter = { $gte: start, $lte: end };
  const match = { createdAt: dateFilter };
  if (endpoint) match.endpoint = endpoint;

  const [overview, endpointBreakdown, sessionAverages, providerTrend] = await Promise.all([
    AIResponseTelemetry.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          fallbackCount: { $sum: { $cond: ['$fallbackUsed', 1, 0] } },
          avgResponseTimeMs: { $avg: '$responseTimeMs' },
          totalInputTokens: { $sum: '$tokenUsage.inputTokens' },
          totalOutputTokens: { $sum: '$tokenUsage.outputTokens' },
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
        },
      },
    ]),
    AIResponseTelemetry.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$endpoint',
          requests: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          fallbackCount: { $sum: { $cond: ['$fallbackUsed', 1, 0] } },
          avgResponseTimeMs: { $avg: '$responseTimeMs' },
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
        },
      },
      { $sort: { requests: -1, _id: 1 } },
    ]),
    AIResponseTelemetry.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$sessionId',
          totalTokens: { $sum: '$tokenUsage.totalTokens' },
        },
      },
      {
        $group: {
          _id: null,
          sessionCount: { $sum: 1 },
          avgTokensPerSession: { $avg: '$totalTokens' },
        },
      },
    ]),
    AIResponseTelemetry.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            bucket: {
              $dateToString: {
                format: getTrendDateFormat(range),
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            provider: '$provider',
          },
          requests: { $sum: 1 },
          fallbackCount: { $sum: { $cond: ['$fallbackUsed', 1, 0] } },
          avgResponseTimeMs: { $avg: '$responseTimeMs' },
        },
      },
      { $sort: { '_id.bucket': 1, '_id.provider': 1 } },
    ]),
  ]);

  const summary = overview[0] || {
    totalRequests: 0,
    successCount: 0,
    fallbackCount: 0,
    avgResponseTimeMs: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
  };
  const sessionSummary = sessionAverages[0] || {
    sessionCount: 0,
    avgTokensPerSession: 0,
  };

  return {
    range,
    window: {
      from: start.toISOString(),
      to: end.toISOString(),
    },
    summary: {
      totalRequests: summary.totalRequests,
      successCount: summary.successCount,
      fallbackCount: summary.fallbackCount,
      openAiCount: providerTrend.filter((item) => item._id.provider === 'openai')
        .reduce((total, item) => total + item.requests, 0),
      mockCount: providerTrend.filter((item) => item._id.provider === 'mock')
        .reduce((total, item) => total + item.requests, 0),
      avgResponseTimeMs: Number(summary.avgResponseTimeMs || 0),
      avgTokensPerSession: Number(sessionSummary.avgTokensPerSession || 0),
      totalTokens: Number(summary.totalTokens || 0),
    },
    endpointBreakdown: endpointBreakdown.map((item) => ({
      endpoint: item._id,
      requests: item.requests,
      successCount: item.successCount,
      fallbackCount: item.fallbackCount,
      avgResponseTimeMs: Number(item.avgResponseTimeMs || 0),
      totalTokens: Number(item.totalTokens || 0),
    })),
    providerTrend: providerTrend.map((item) => ({
      bucket: item._id.bucket,
      provider: item._id.provider,
      requests: item.requests,
      fallbackCount: item.fallbackCount,
      avgResponseTimeMs: Number(item.avgResponseTimeMs || 0),
    })),
  };
}

module.exports = {
  anonymizeUserId,
  getAiTelemetryReport,
  recordAiTelemetry,
};
