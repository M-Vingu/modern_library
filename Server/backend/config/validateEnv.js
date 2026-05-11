const { AppError } = require('../utils/appError');

function requireEnv(name) {
  if (!process.env[name] || !String(process.env[name]).trim()) {
    throw new AppError('ENV_MISSING', `Missing required environment variable: ${name}`, 500);
  }
}

function rejectEnv(name, message) {
  throw new AppError('ENV_INVALID', `${name}: ${message}`, 500);
}

function validateEnv() {
  requireEnv('MONGO_URI');
  requireEnv('JWT_SECRET');
  if (!process.env.JWT_EXPIRES_IN) requireEnv('JWT_EXPIRES_IN');
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const frontendUrl = String(process.env.FRONTEND_URL || '').trim();
  const frontendUrls = String(process.env.FRONTEND_URLS || '').trim();

  if (isProduction) {
    if (!frontendUrl && !frontendUrls) {
      rejectEnv('FRONTEND_URLS', 'set FRONTEND_URL or FRONTEND_URLS in production');
    }
    const declaredOrigins = (frontendUrls || frontendUrl)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (declaredOrigins.some((origin) => !/^https:\/\//i.test(origin))) {
      rejectEnv('FRONTEND_URLS', 'production frontend origins must use https://');
    }
  }

  const provider = (process.env.PAST_PAPER_STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider === 's3') {
    requireEnv('S3_REGION');
    requireEnv('S3_BUCKET');
    requireEnv('S3_ACCESS_KEY_ID');
    requireEnv('S3_SECRET_ACCESS_KEY');
  }
  if (provider === 'cloudinary') {
    requireEnv('CLOUDINARY_CLOUD_NAME');
    requireEnv('CLOUDINARY_API_KEY');
    requireEnv('CLOUDINARY_API_SECRET');
  }

  if (String(process.env.RUN_JOB_WORKER || 'false').toLowerCase() === 'true') {
    requireEnv('REDIS_URL');
  }

  const aiProvider = String(process.env.AI_PROVIDER || 'mock').toLowerCase();
  if (isProduction && aiProvider === 'mock') {
    rejectEnv('AI_PROVIDER', 'mock provider is not allowed in production');
  }
  if (aiProvider === 'openai') {
    requireEnv('OPENAI_API_KEY');
  }

  if (process.env.AI_PROMPT_VERSION_BY_ENDPOINT_JSON) {
    try {
      JSON.parse(process.env.AI_PROMPT_VERSION_BY_ENDPOINT_JSON);
    } catch (_err) {
      rejectEnv('AI_PROMPT_VERSION_BY_ENDPOINT_JSON', 'must be valid JSON');
    }
  }

  if (String(process.env.MFA_ENFORCED || 'false').toLowerCase() === 'true') {
    requireEnv('MFA_ISSUER');
    const method = String(process.env.MFA_DEFAULT_METHOD || 'email_otp').toLowerCase();
    if (method === 'email_otp') {
      const emailProvider = String(process.env.NOTIFICATION_EMAIL_PROVIDER || 'log').toLowerCase();
      if (isProduction && emailProvider === 'log') {
        rejectEnv('NOTIFICATION_EMAIL_PROVIDER', 'log provider is not allowed for enforced MFA in production');
      }
      if (emailProvider === 'smtp') {
        requireEnv('SMTP_HOST');
        requireEnv('SMTP_FROM');
      }
    }
    if (method === 'sms_otp') {
      const smsProvider = String(process.env.NOTIFICATION_SMS_PROVIDER || 'log').toLowerCase();
      if (isProduction && smsProvider === 'log') {
        rejectEnv('NOTIFICATION_SMS_PROVIDER', 'log provider is not allowed for enforced MFA in production');
      }
      if (smsProvider === 'twilio') {
        requireEnv('TWILIO_ACCOUNT_SID');
        requireEnv('TWILIO_AUTH_TOKEN');
        requireEnv('TWILIO_FROM');
      }
    }
  }
}

module.exports = { validateEnv };
