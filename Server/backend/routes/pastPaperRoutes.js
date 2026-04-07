const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  createPastPaper,
  uploadPastPaper,
  listPastPapers,
  getPastPaperById,
  downloadPastPaper,
  verifyPastPaper,
} = require('../controllers/pastPaperController');

router.get('/', listPastPapers);
router.get('/:id', getPastPaperById);
router.post('/', protect, createPastPaper);
router.post('/upload/base64', protect, uploadPastPaper);
router.post('/:id/download', protect, downloadPastPaper);
router.patch('/:id/verify', protect, authorizeRoles('admin'), verifyPastPaper);

module.exports = router;
