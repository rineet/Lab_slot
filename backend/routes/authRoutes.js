const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { register, login, logout, getMe, changePassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', auth, getMe);
router.post('/change-password', auth, changePassword);

module.exports = router;

