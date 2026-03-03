const express = require('express');
const multer = require('multer');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { uploadAttendance, publishAttendance, getMyAttendance } = require('../controllers/attendanceController');

const upload = multer();

// Faculty: Excel upload and publish
router.post('/upload', auth, role(['Faculty', 'Admin']), upload.single('file'), uploadAttendance);
router.post('/publish', auth, role(['Faculty', 'Admin']), publishAttendance);

// Student: view own attendance
router.get('/my', auth, role(['Student']), getMyAttendance);

module.exports = router;

