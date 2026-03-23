const express = require('express');
const multer = require('multer');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { uploadMarks, publishMarks, getMyMarks } = require('../controllers/marksController');

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isXlsxMime = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const isXlsxName = /\.xlsx$/i.test(file.originalname || '');
    if (isXlsxMime || isXlsxName) return cb(null, true);
    return cb(new Error('Invalid file type. Please upload a .xlsx Excel file only.'));
  }
});

// Faculty/Admin: upload and publish
router.post('/upload', auth, role(['Faculty', 'Admin']), upload.single('file'), uploadMarks);
router.post('/publish', auth, role(['Faculty', 'Admin']), publishMarks);

// Student: view own marks
router.get('/my', auth, role(['Student']), getMyMarks);

module.exports = router;
