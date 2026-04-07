const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const provider = (process.env.PAST_PAPER_STORAGE_PROVIDER || 'local').toLowerCase();
const localRoot = process.env.PAST_PAPER_LOCAL_DIR || path.join(__dirname, '..', 'storage', 'past-papers');
const downloadTokenTtl = process.env.PAST_PAPER_DOWNLOAD_TOKEN_TTL || '15m';
const externalDownloadTtlSec = Number(process.env.PAST_PAPER_EXTERNAL_SIGNED_TTL_SEC || 900);

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

function parseBuffer(contentBase64) {
  if (!contentBase64) throw new Error('contentBase64 is required');
  const fileBuffer = Buffer.from(contentBase64, 'base64');
  if (!fileBuffer.length) throw new Error('Invalid base64 payload');
  return fileBuffer;
}

function getCloudinaryClient() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Missing Cloudinary environment variables');
  }
  // eslint-disable-next-line global-require
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function getS3Clients() {
  const { S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
  if (!S3_REGION || !S3_BUCKET) throw new Error('Missing S3_REGION or S3_BUCKET');

  // eslint-disable-next-line global-require
  const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
  // eslint-disable-next-line global-require
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

  const accessKeyId = S3_ACCESS_KEY_ID || AWS_ACCESS_KEY_ID;
  const secretAccessKey = S3_SECRET_ACCESS_KEY || AWS_SECRET_ACCESS_KEY;

  const client = new S3Client({
    region: S3_REGION,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });

  return { client, bucket: S3_BUCKET, PutObjectCommand, GetObjectCommand, getSignedUrl };
}

async function storeToLocal({ originalFileName, mimeType, fileBuffer }) {
  ensureDir(localRoot);
  const fileKey = createFileKey(originalFileName);
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

async function storeToS3({ originalFileName, mimeType, fileBuffer }) {
  const fileKey = createFileKey(originalFileName);
  const { client, bucket, PutObjectCommand } = getS3Clients();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mimeType || 'application/octet-stream',
  }));
  return {
    provider: 's3',
    fileKey,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: fileBuffer.length,
    originalFileName: originalFileName || fileKey,
    fileUrl: null,
  };
}

async function storeToCloudinary({ originalFileName, mimeType, fileBuffer }) {
  const cloudinary = getCloudinaryClient();
  const fileKey = createFileKey(originalFileName);
  const folder = process.env.CLOUDINARY_PAST_PAPER_FOLDER || 'past-papers';
  const resourceType = 'raw';
  const dataUri = `data:${mimeType || 'application/octet-stream'};base64,${fileBuffer.toString('base64')}`;

  const uploaded = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    public_id: fileKey,
    overwrite: false,
    invalidate: false,
  });

  return {
    provider: 'cloudinary',
    fileKey: uploaded.public_id,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: fileBuffer.length,
    originalFileName: originalFileName || fileKey,
    fileUrl: uploaded.secure_url || uploaded.url || null,
  };
}

async function storeFileFromBase64({ originalFileName, mimeType, contentBase64 }) {
  const fileBuffer = parseBuffer(contentBase64);

  if (provider === 'local') return storeToLocal({ originalFileName, mimeType, fileBuffer });
  if (provider === 's3') return storeToS3({ originalFileName, mimeType, fileBuffer });
  if (provider === 'cloudinary') return storeToCloudinary({ originalFileName, mimeType, fileBuffer });

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

async function getSignedExternalDownloadUrl({ storageProvider, fileKey, fileUrl }) {
  if (storageProvider === 's3') {
    const { client, bucket, GetObjectCommand, getSignedUrl } = getS3Clients();
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: fileKey });
    return getSignedUrl(client, cmd, { expiresIn: externalDownloadTtlSec });
  }

  if (storageProvider === 'cloudinary') {
    const cloudinary = getCloudinaryClient();
    const expiresAt = Math.floor(Date.now() / 1000) + externalDownloadTtlSec;
    return cloudinary.utils.private_download_url(fileKey, 'pdf', {
      resource_type: 'raw',
      expires_at: expiresAt,
      attachment: true,
    });
  }

  if (fileUrl) return fileUrl;
  return null;
}

function generateClassroomToken({ sessionId, userId, role }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required');
  const payload = {
    purpose: 'live-classroom',
    sessionId,
    userId,
    role: role || 'participant',
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  return jwt.sign(payload, secret, { expiresIn: '2h', algorithm: 'HS256' });
}

module.exports = {
  storeFileFromBase64,
  signDownloadToken,
  verifyDownloadToken,
  buildSignedDownloadUrl,
  streamLocalFile,
  getSignedExternalDownloadUrl,
  generateClassroomToken,
};
