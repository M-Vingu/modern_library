const mongoose = require('mongoose');
const PastPaper = require('../models/PastPaper');
const {
  storeFileFromBase64,
  signDownloadToken,
  verifyDownloadToken,
  buildSignedDownloadUrl,
  streamLocalFile,
  getSignedExternalDownloadUrl,
} = require('../services/pastPaperStorageService');

function canAccessPaper(item, reqUser) {
  if (item.visibility === 'public') return true;
  if (!reqUser) return false;
  return reqUser.role === 'admin' || item.uploadedBy.toString() === reqUser.id;
}

async function createPastPaper(req, res) {
  try {
    const {
      title,
      institution,
      course,
      unitCode,
      subject,
      year,
      examType,
      semester,
      level,
      tags,
      fileUrl,
      visibility,
    } = req.body;

    if (!title || !institution || !course || !subject || !year || !fileUrl) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const pastPaper = await PastPaper.create({
      title,
      institution,
      course,
      unitCode,
      subject,
      year: Number(year),
      examType,
      semester,
      level,
      tags: Array.isArray(tags) ? tags : [],
      fileUrl,
      storageProvider: 'external',
      uploadedBy: req.user.id,
      visibility: visibility || 'public',
      isVerified: req.user.role === 'admin',
    });

    res.status(201).json(pastPaper);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function uploadPastPaper(req, res) {
  try {
    const {
      title,
      institution,
      course,
      unitCode,
      subject,
      year,
      examType,
      semester,
      level,
      tags,
      visibility,
      originalFileName,
      mimeType,
      contentBase64,
    } = req.body;

    if (!title || !institution || !course || !subject || !year || !originalFileName || !contentBase64) {
      return res.status(400).json({ message: 'Missing required upload fields' });
    }

    const stored = await storeFileFromBase64({
      originalFileName,
      mimeType,
      contentBase64,
    });

    const item = await PastPaper.create({
      title,
      institution,
      course,
      unitCode,
      subject,
      year: Number(year),
      examType,
      semester,
      level,
      tags: Array.isArray(tags) ? tags : [],
      fileUrl: stored.fileUrl || null,
      storageProvider: stored.provider,
      fileKey: stored.fileKey,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      originalFileName: stored.originalFileName,
      uploadedBy: req.user.id,
      visibility: visibility || 'public',
      isVerified: req.user.role === 'admin',
    });

    const token = signDownloadToken({
      paperId: item._id.toString(),
      fileKey: item.fileKey,
      fileUrl: item.fileUrl || null,
      userId: req.user.id,
    });

    res.status(201).json({
      message: 'Past paper uploaded successfully',
      item,
      signedDownloadUrl: buildSignedDownloadUrl(req, token),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPastPapers(req, res) {
  try {
    const {
      q,
      institution,
      course,
      subject,
      year,
      examType,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { visibility: 'public' };
    if (q) filter.$text = { $search: q };
    if (institution) filter.institution = new RegExp(institution, 'i');
    if (course) filter.course = new RegExp(course, 'i');
    if (subject) filter.subject = new RegExp(subject, 'i');
    if (year) filter.year = Number(year);
    if (examType) filter.examType = examType;

    const safeLimit = Math.min(Number(limit) || 20, 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const items = await PastPaper.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .select('-__v');

    const total = await PastPaper.countDocuments(filter);

    res.json({
      page: safePage,
      limit: safeLimit,
      total,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPastPaperById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid past paper id' });
    }

    const item = await PastPaper.findById(req.params.id).select('-__v');
    if (!item) return res.status(404).json({ message: 'Past paper not found' });

    if (!canAccessPaper(item, req.user)) return res.status(403).json({ message: 'Forbidden' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function downloadPastPaper(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid past paper id' });
    }

    const item = await PastPaper.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Past paper not found' });
    if (!canAccessPaper(item, req.user)) return res.status(403).json({ message: 'Forbidden' });

    await PastPaper.findByIdAndUpdate(item._id, { $inc: { downloadCount: 1 } });

    const token = signDownloadToken({
      paperId: item._id.toString(),
      fileKey: item.fileKey || null,
      fileUrl: item.fileUrl || null,
      userId: req.user?.id || null,
    });

    res.json({
      message: 'Signed download URL generated',
      signedDownloadUrl: buildSignedDownloadUrl(req, token),
      expiresIn: process.env.PAST_PAPER_DOWNLOAD_TOKEN_TTL || '15m',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function resolveSignedPastPaperDownload(req, res) {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: 'Download token is required' });

    const payload = verifyDownloadToken(token);
    if (payload.purpose !== 'past-paper-download' || !payload.paperId) {
      return res.status(400).json({ message: 'Invalid download token' });
    }

    const item = await PastPaper.findById(payload.paperId);
    if (!item) return res.status(404).json({ message: 'Past paper not found' });

    if (item.storageProvider === 'local' && item.fileKey) {
      const ok = streamLocalFile(item.fileKey, res);
      if (!ok) return res.status(404).json({ message: 'Stored file not found' });
      return;
    }

    const externalUrl = await getSignedExternalDownloadUrl({
      storageProvider: item.storageProvider,
      fileKey: item.fileKey,
      fileUrl: item.fileUrl,
    });
    if (externalUrl) return res.redirect(externalUrl);
    return res.status(400).json({ message: 'No downloadable resource for this paper' });
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired download token' });
  }
}

async function verifyPastPaper(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid past paper id' });
    }

    const item = await PastPaper.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { returnDocument: 'after' },
    );

    if (!item) return res.status(404).json({ message: 'Past paper not found' });
    res.json({ message: 'Past paper verified', item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createPastPaper,
  uploadPastPaper,
  listPastPapers,
  getPastPaperById,
  downloadPastPaper,
  resolveSignedPastPaperDownload,
  verifyPastPaper,
};
