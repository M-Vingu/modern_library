function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getConfiguredAiProvider() {
  return String(process.env.AI_PROVIDER || 'mock').trim().toLowerCase();
}

function getConfiguredOpenAiModel() {
  const explicitModel = String(process.env.OPENAI_MODEL || '').trim();
  if (explicitModel) return explicitModel;

  const genericModel = String(process.env.AI_MODEL || '').trim();
  if (genericModel && !genericModel.startsWith('scaffold-')) return genericModel;
  return 'gpt-5.4';
}

function getDefaultFallbackModel() {
  return String(process.env.AI_MODEL || 'scaffold-v2').trim() || 'scaffold-v2';
}

function getConfiguredPromptVersion({ endpoint = 'ai.chat', requestedPromptVersion } = {}) {
  const allowOverride = String(process.env.AI_PROMPT_ALLOW_CLIENT_OVERRIDE || 'false').toLowerCase() === 'true';
  if (allowOverride && String(requestedPromptVersion || '').trim()) {
    return String(requestedPromptVersion).trim().slice(0, 80);
  }

  const endpointMapRaw = String(process.env.AI_PROMPT_VERSION_BY_ENDPOINT_JSON || '').trim();
  if (endpointMapRaw) {
    try {
      const endpointMap = JSON.parse(endpointMapRaw);
      if (endpoint && typeof endpointMap?.[endpoint] === 'string' && endpointMap[endpoint].trim()) {
        return endpointMap[endpoint].trim().slice(0, 80);
      }
    } catch (_err) {
      // Ignore malformed endpoint map and fall back to the default prompt version.
    }
  }

  return String(process.env.AI_PROMPT_VERSION || 'ai-tutor-rag-v2').trim().slice(0, 80);
}

function getMaintenanceConfig() {
  return {
    schedulerEnabled: String(process.env.AI_MAINTENANCE_SCHEDULER_ENABLED || 'true').toLowerCase() === 'true',
    schedulerRole: String(process.env.AI_MAINTENANCE_SCHEDULER_ROLE || 'api').toLowerCase(),
    cron: String(process.env.AI_MAINTENANCE_CRON || '*/30 * * * *').trim(),
    inactiveDays: normalizePositiveInt(process.env.AI_MAINTENANCE_INACTIVE_DAYS, 30),
    batchLimit: normalizePositiveInt(process.env.AI_MAINTENANCE_BATCH_LIMIT, 20),
    retryAttempts: normalizePositiveInt(process.env.AI_MAINTENANCE_RETRY_ATTEMPTS, 3),
    retryDelayMs: normalizePositiveInt(process.env.AI_MAINTENANCE_RETRY_DELAY_MS, 1500),
  };
}

module.exports = {
  getConfiguredAiProvider,
  getConfiguredOpenAiModel,
  getConfiguredPromptVersion,
  getDefaultFallbackModel,
  getMaintenanceConfig,
  normalizePositiveInt,
};
