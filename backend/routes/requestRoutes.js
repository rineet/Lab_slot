const express = require('express');
const path = require('path');
const multer = require('multer');
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const requestController = require('../controllers/requestController');

const router = express.Router();

const documentsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads', 'documents')),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc-${unique}${path.extname(file.originalname) || '.pdf'}`);
  }
});

const pdfFilter = (_req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdf) return cb(new Error('Only PDF files are allowed'));
  return cb(null, true);
};

const uploadDocument = multer({
  storage: documentsStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/recipients', auth, requestController.listRecipients);

router.post(
  '/',
  auth,
  roleMiddleware(['Student']),
  uploadDocument.single('document'),
  requestController.createRequest
);

router.get('/student/my', auth, roleMiddleware(['Student']), requestController.getStudentRequests);

router.get('/inbox', auth, roleMiddleware(['Faculty', 'Admin']), requestController.getProfessorInbox);
router.post('/:id/approve', auth, roleMiddleware(['Faculty', 'Admin']), requestController.approveRequest);
router.post('/:id/reject', auth, roleMiddleware(['Faculty', 'Admin']), requestController.rejectRequest);
router.post('/:id/forward', auth, roleMiddleware(['Faculty', 'Admin']), requestController.forwardRequest);

module.exports = router;
