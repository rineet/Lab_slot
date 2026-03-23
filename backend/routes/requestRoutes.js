const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validationMiddleware = require('../middleware/validationMiddleware');
const requestController = require('../controllers/requestController');

const router = express.Router();

// Keep legacy upload path available to avoid ENOENT in environments still using disk uploads.
const legacyUploadDir = path.join(__dirname, '..', '..', 'uploads', 'documents');
if (!fs.existsSync(legacyUploadDir)) {
  fs.mkdirSync(legacyUploadDir, { recursive: true });
}

const pdfFilter = (_req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdf) return cb(new Error('Only PDF files are allowed'));
  return cb(null, true);
};

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/recipients', auth, requestController.listRecipients);

router.post(
  '/',
  auth,
  roleMiddleware(['Student']),
  uploadDocument.single('document'),
  validationMiddleware([validationMiddleware.validateDocumentRequest]),
  requestController.createRequest
);

router.get('/student/my', auth, roleMiddleware(['Student']), requestController.getStudentRequests);

router.get('/inbox', auth, roleMiddleware(['Faculty', 'Admin']), requestController.getProfessorInbox);
router.get('/:id/document', auth, requestController.getRequestDocument);
router.post('/:id/approve', auth, roleMiddleware(['Faculty', 'Admin']), requestController.approveRequest);
router.post('/:id/reject', auth, roleMiddleware(['Faculty', 'Admin']), requestController.rejectRequest);
router.post('/:id/forward', auth, roleMiddleware(['Faculty', 'Admin']), requestController.forwardRequest);

module.exports = router;
