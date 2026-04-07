const express = require('express');
const router = express.Router();

const { resolveSignedPastPaperDownload } = require('../controllers/pastPaperController');

router.get('/past-papers/download', resolveSignedPastPaperDownload);

module.exports = router;
