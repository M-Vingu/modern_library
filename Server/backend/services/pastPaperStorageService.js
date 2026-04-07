const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const provider = (process.env.PAST_PAPER_STORAGE_PROVIDER || 'local').toLowerCase();
const localRoot = process.env.PAST_PAPER_LOCAL_DIR || path.join(__dirname, '..', 'storage', 'past-papers');
const downloadTokenTtl = process.env.PAST_PAPER_DOWNLOAD_TOKEN_TTL || '15m';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function safeFileName(name) {
  return String(name || 'paper')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function createFileKey(originalFileName) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ts}-${rand}-${safeFileName(originalFileName)}`;
}

async function storeFileFromBase64({ originalFileName, mimeType, contentBase64 }) {
  if (!contentBase64) throw new Error('contentBase64 is required');

  const fileBuffer = Buffer.from(contentBase64, 'base64');
  if (!fileBuffer.length) throw new Error('Invalid base64 payload');

  const fileKey = createFileKey(originalFileName);

  if (provider === 'local') {
    ensureDir(localRoot);
    const fullPath = path.join(localRoot, fileKey);
    fs.writeFileSync(fullPath, fileBuffer);
    return {
      provider: 'local',
      fileKey,
      mimeType: mimeType || 'application/octet-stream',
      fileSize: fileBuffer.length,
      originalFileName: originalFileName || fileKey,
      fileUrl: null,
    };
  }

  // Scaffold placeholders for future S3/Cloudinary integration.
  if (provider === 's3' || provider === 'cloudinary') {
    throw new Error(`${provider} upload integration scaffolded but not configured yet`);
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

function signDownloadToken({ paperId, fileKey, fileUrl, userId }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for signed download URLs');
  return jwt.sign(
    { purpose: 'past-paper-download', paperId, fileKey, fileUrl, userId: userId || null },
    secret,
    { expiresIn: downloadTokenTtl, algorithm: 'HS256' },
  );
}

function verifyDownloadToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for signed download URLs');
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

function buildSignedDownloadUrl(req, token) {
  const protocol = req.protocol || 'http';
  const host = req.get ? req.get('host') : 'localhost:5000';
  return `${protocol}://${host}/api/files/past-papers/download?token=${encodeURIComponent(token)}`;
}

function streamLocalFile(fileKey, res) {
  const fullPath = path.join(localRoot, fileKey);
  if (!fs.existsSync(fullPath)) return false;
  res.download(fullPath);
  return true;
}

module.exports = {
  storeFileFromBase64,
  signDownloadToken,
  verifyDownloadToken,
  buildSignedDownloadUrl,
  streamLocalFile,
};
