const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  createSlotRequest,
  cancelSlot,
  getMyRequests,
  getResourceCalendar,
  getFacultyPending,
  approveSlot,
  rejectSlot
} = require('../controllers/slotController');

router.post('/request', auth, role(['Student']), createSlotRequest);
router.post('/cancel/:id', auth, cancelSlot);
router.get('/my', auth, role(['Student']), getMyRequests);
router.get('/resource/:id', auth, getResourceCalendar);
router.get('/faculty/pending', auth, role(['Faculty', 'Admin']), getFacultyPending);
router.post('/approve/:id', auth, role(['Faculty', 'Admin']), approveSlot);
router.post('/reject/:id', auth, role(['Faculty', 'Admin']), rejectSlot);

module.exports = router;

