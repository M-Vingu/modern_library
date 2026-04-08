const { AppError } = require('../utils/appError');

function requireEnv(name) {
  if (!process.env[name] || !String(process.env[name]).trim()) {
    throw new AppError('ENV_MISSING', `Missing required environment variable: ${name}`, 500);
  }
}

function validateEnv() {
  requireEnv('MONGO_URI');
  requireEnv('JWT_SECRET');
  if (!process.env.JWT_EXPIRES_IN) requireEnv('JWT_EXPIRES_IN');

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

  if (String(process.env.MFA_ENFORCED || 'false').toLowerCase() === 'true') {
    requireEnv('MFA_ISSUER');
    const method = String(process.env.MFA_DEFAULT_METHOD || 'email_otp').toLowerCase();
    if (method === 'email_otp') {
      const emailProvider = String(process.env.NOTIFICATION_EMAIL_PROVIDER || 'log').toLowerCase();
      if (emailProvider === 'smtp') {
        requireEnv('SMTP_HOST');
        requireEnv('SMTP_FROM');
      }
    }
    if (method === 'sms_otp') {
      const smsProvider = String(process.env.NOTIFICATION_SMS_PROVIDER || 'log').toLowerCase();
      if (smsProvider === 'twilio') {
        requireEnv('TWILIO_ACCOUNT_SID');
        requireEnv('TWILIO_AUTH_TOKEN');
        requireEnv('TWILIO_FROM');
      }
    }
  }
}

module.exports = { validateEnv };
