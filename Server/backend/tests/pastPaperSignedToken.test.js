const test = require('node:test');
const assert = require('node:assert/strict');

const {
  signDownloadToken,
  verifyDownloadToken,
} = require('../services/pastPaperStorageService');

test('past paper signed token roundtrip works', async () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = signDownloadToken({
    paperId: '507f1f77bcf86cd799439011',
    fileKey: 'sample.pdf',
    fileUrl: null,
    userId: '507f1f77bcf86cd799439012',
  });

  const payload = verifyDownloadToken(token);
  assert.equal(payload.purpose, 'past-paper-download');
  assert.equal(payload.paperId, '507f1f77bcf86cd799439011');
  assert.equal(payload.fileKey, 'sample.pdf');
});
