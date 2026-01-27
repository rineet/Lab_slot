const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { listFaculty } = require('../controllers/userController');

router.get('/faculty', auth, listFaculty);

module.exports = router;

