const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { listUsers, changeRole, updatePolicy, getPolicy, updateUser } = require('../controllers/adminController');

router.get('/users', auth, role(['Admin']), listUsers);
router.put('/users/:id/role', auth, role(['Admin']), changeRole);
router.put('/users/:id', auth, role(['Admin']), updateUser);
router.get('/policies', auth, role(['Admin']), getPolicy);
router.put('/policies', auth, role(['Admin']), updatePolicy);

module.exports = router;

