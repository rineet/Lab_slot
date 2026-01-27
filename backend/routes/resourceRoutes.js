const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  listResources,
  createResource,
  updateResource,
  deleteResource
} = require('../controllers/resourceController');

router.get('/', listResources);
router.post('/', auth, role(['Admin']), createResource);
router.put('/:id', auth, role(['Admin']), updateResource);
router.delete('/:id', auth, role(['Admin']), deleteResource);

module.exports = router;

