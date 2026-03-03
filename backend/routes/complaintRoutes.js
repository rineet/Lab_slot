const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createComplaint,
  getMyComplaints,
  listComplaints,
  updateComplaintStatus,
  getFacultyComplaints
} = require('../controllers/complaintController');

// Student & Faculty: create + view own
router.post('/', auth, role(['Student', 'Faculty']), createComplaint);
router.get('/my', auth, getMyComplaints);

// Faculty: view complaints for their resources
router.get('/faculty/assigned', auth, role(['Faculty']), getFacultyComplaints);

// Admin: list + update
router.get('/', auth, role(['Admin']), listComplaints);
router.put('/:id/status', auth, role(['Admin']), updateComplaintStatus);

module.exports = router;

