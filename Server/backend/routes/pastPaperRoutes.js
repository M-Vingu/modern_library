const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const {
  pastPaperCreateSchema,
  pastPaperUploadSchema,
  idParamOnlySchema,
  pastPaperVerifySchema,
} = require('../validations/legacySchemas');
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
router.post('/', protect, validateRequest(pastPaperCreateSchema), createPastPaper);
router.post('/upload/base64', protect, validateRequest(pastPaperUploadSchema), uploadPastPaper);
router.post('/:id/download', protect, validateRequest(idParamOnlySchema), downloadPastPaper);
router.patch('/:id/verify', protect, authorizeRoles('admin'), validateRequest(pastPaperVerifySchema), verifyPastPaper);

module.exports = router;
