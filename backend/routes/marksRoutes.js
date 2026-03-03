const express = require('express');
const multer = require('multer');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { uploadMarks, publishMarks, getMyMarks } = require('../controllers/marksController');

const upload = multer();

// Faculty/Admin: upload and publish
router.post('/upload', auth, role(['Faculty', 'Admin']), upload.single('file'), uploadMarks);
router.post('/publish', auth, role(['Faculty', 'Admin']), publishMarks);

// Student: view own marks
router.get('/my', auth, role(['Student']), getMyMarks);

module.exports = router;

