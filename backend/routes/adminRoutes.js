const express = require('express');
const multer = require('multer');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
	listUsers,
	changeRole,
	updatePolicy,
	getPolicy,
	updateUser,
	bulkCreateStudents,
	createFaculty,
	bulkCreateFaculty,
	purgeAllExceptAdmins
} = require('../controllers/adminController');

const upload = multer();

router.get('/users', auth, role(['Admin']), listUsers);
router.put('/users/:id/role', auth, role(['Admin']), changeRole);
router.put('/users/:id', auth, role(['Admin']), updateUser);
router.get('/policies', auth, role(['Admin']), getPolicy);
router.put('/policies', auth, role(['Admin']), updatePolicy);
router.post('/bulk-students', auth, role(['Admin']), upload.single('file'), bulkCreateStudents);
router.post('/faculty', auth, role(['Admin']), createFaculty);
router.post('/bulk-faculty', auth, role(['Admin']), upload.single('file'), bulkCreateFaculty);
router.post('/purge', auth, role(['Admin']), purgeAllExceptAdmins);

module.exports = router;

