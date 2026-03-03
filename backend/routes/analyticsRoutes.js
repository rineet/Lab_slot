const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { venueUtilization, facultyWorkload } = require('../controllers/analyticsController');

router.get('/venue-utilization', auth, role(['Admin']), venueUtilization);
router.get('/faculty-workload', auth, role(['Admin']), facultyWorkload);

module.exports = router;

