const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const { register, login, logout, getMe, changePassword } = require('../controllers/authController');

router.post('/register', validationMiddleware([validationMiddleware.validateRegister]), register);
router.post('/login', validationMiddleware([validationMiddleware.validateLogin]), login);
router.post('/logout', logout);
router.get('/me', auth, getMe);
router.post('/change-password', auth, validationMiddleware([validationMiddleware.validateChangePassword]), changePassword);

module.exports = router;
