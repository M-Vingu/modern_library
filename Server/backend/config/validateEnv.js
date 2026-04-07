const { AppError } = require('../utils/appError');

function requireEnv(name) {
  if (!process.env[name] || !String(process.env[name]).trim()) {
    throw new AppError('ENV_MISSING', `Missing required environment variable: ${name}`, 500);
  }
}

function validateEnv() {
  requireEnv('MONGO_URI');
  requireEnv('JWT_SECRET');

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
}

module.exports = { validateEnv };
