const Request = require('../models/Request');
const User = require('../models/User');

async function getStudentProfile(req) {
  const user = await User.findById(req.user.id).select('name');
  return user;
}

function parseRecipientIds(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.map((v) => String(v).trim()).filter(Boolean) : [];
    }
    return [trimmed];
  }
  return [];
}

exports.listRecipients = async (req, res, next) => {
  try {
    const recipients = await User.find({ role: { $in: ['Faculty', 'Admin'] }, isActive: true }).select(
      '_id name email role'
    ).lean();
    res.json(recipients);
  } catch (err) {
    next(err);
  }
};

exports.createRequest = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'PDF document is required' });
    }

    const { name, to, cc, bcc, subject, shortMessage } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ message: 'to and subject are required' });
    }

    const profile = await getStudentProfile(req);
    const parsedTo = parseRecipientIds(to);
    const parsedCC = parseRecipientIds(cc);
    const parsedBCC = parseRecipientIds(bcc);

    if (!parsedTo.length) {
      return res.status(400).json({ message: 'Please select at least one recipient in To' });
    }

    const primaryTo = parsedTo[0];
    const additionalTo = parsedTo.slice(1);
    const mergedCC = [...new Set([...parsedCC, ...additionalTo])];
    const mergedBCC = [...new Set(parsedBCC.filter((id) => id !== primaryTo))];

    const validRecipients = await User.find({
      _id: { $in: [primaryTo, ...mergedCC, ...mergedBCC] },
      role: { $in: ['Faculty', 'Admin'] },
      isActive: true
    }).select('_id');
    const validRecipientIds = new Set(validRecipients.map((u) => String(u._id)));
    if (!validRecipientIds.has(String(primaryTo))) {
      return res.status(400).json({ message: 'Primary To recipient must be an active Faculty/Admin user' });
    }

    const created = await Request.create({
      studentId: req.user.id,
      name: (name || profile?.name || 'Student').trim(),
      to: primaryTo,
      cc: mergedCC.filter((id) => validRecipientIds.has(String(id))),
      bcc: mergedBCC.filter((id) => validRecipientIds.has(String(id))),
      subject: subject.trim(),
      shortMessage: shortMessage ? shortMessage.trim() : '',
      documentPath: '',
      documentName: req.file.originalname || 'document.pdf',
      documentMimeType: req.file.mimetype || 'application/pdf',
      documentSize: req.file.size,
      documentData: req.file.buffer,
      approvalType: 'approval',
      status: 'Pending'
    });

    return res.status(201).json({
      message: 'Request submitted successfully',
      request: {
        _id: created._id,
        subject: created.subject,
        status: created.status,
        createdAt: created.createdAt
      }
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ message: 'Invalid CC/BCC format' });
    }
    return next(err);
  }
};

exports.getRequestDocument = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id).select(
      'studentId to cc bcc forwardedTo documentName documentMimeType documentData documentPath'
    );
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const myId = String(req.user.id);
    const canAccess =
      String(request.studentId) === myId ||
      String(request.to) === myId ||
      (request.forwardedTo && String(request.forwardedTo) === myId) ||
      (Array.isArray(request.cc) && request.cc.some((id) => String(id) === myId)) ||
      (Array.isArray(request.bcc) && request.bcc.some((id) => String(id) === myId));

    if (!canAccess) {
      return res.status(403).json({ message: 'Not authorized to view this document' });
    }

    if (request.documentData && request.documentData.length) {
      const fileName = request.documentName || 'document.pdf';
      res.setHeader('Content-Type', request.documentMimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/\"/g, '')}"`);
      return res.send(request.documentData);
    }

    return res.status(404).json({
      message: 'Document data not found in database. Please re-upload this request document.'
    });
  } catch (err) {
    return next(err);
  }
};

exports.getStudentRequests = async (req, res, next) => {
  try {
    const rows = await Request.find({ studentId: req.user.id })
      .select('-documentData')
      .populate('to', 'name email role')
      .populate('forwardedTo', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getProfessorInbox = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const rows = await Request.find({
      $or: [{ to: myId }, { cc: { $in: [myId] } }, { bcc: { $in: [myId] } }, { forwardedTo: myId }]
    })
      .select('-documentData')
      .populate('studentId', 'name email rollNumber')
      .populate('to', 'name email role')
      .populate('forwardedTo', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.approveRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const canAct =
      String(request.to) === String(req.user.id) ||
      String(request.forwardedTo || '') === String(req.user.id) ||
      (Array.isArray(request.cc) && request.cc.some((id) => String(id) === String(req.user.id))) ||
      (Array.isArray(request.bcc) && request.bcc.some((id) => String(id) === String(req.user.id)));
    if (!canAct) {
      return res.status(403).json({ message: 'Only assigned professor/admin can approve' });
    }

    request.status = 'Approved';
    await request.save();

    res.json({ message: 'Request approved', request });
  } catch (err) {
    next(err);
  }
};

exports.rejectRequest = async (req, res, next) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const canAct =
      String(request.to) === String(req.user.id) ||
      String(request.forwardedTo || '') === String(req.user.id) ||
      (Array.isArray(request.cc) && request.cc.some((id) => String(id) === String(req.user.id))) ||
      (Array.isArray(request.bcc) && request.bcc.some((id) => String(id) === String(req.user.id)));
    if (!canAct) {
      return res.status(403).json({ message: 'Only assigned professor/admin can reject' });
    }

    request.status = 'Rejected';
    await request.save();

    res.json({ message: 'Request rejected', request });
  } catch (err) {
    next(err);
  }
};

exports.forwardRequest = async (req, res, next) => {
  try {
    const { forwardedTo, message } = req.body;
    if (!forwardedTo) {
      return res.status(400).json({ message: 'forwardedTo is required' });
    }

    const target = await User.findOne({ _id: forwardedTo, role: { $in: ['Faculty', 'Admin'] }, isActive: true });
    if (!target) {
      return res.status(400).json({ message: 'Forward target must be active faculty/admin' });
    }

    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const canAct =
      String(request.to) === String(req.user.id) ||
      String(request.forwardedTo || '') === String(req.user.id) ||
      (Array.isArray(request.cc) && request.cc.some((id) => String(id) === String(req.user.id))) ||
      (Array.isArray(request.bcc) && request.bcc.some((id) => String(id) === String(req.user.id)));
    if (!canAct) {
      return res.status(403).json({ message: 'Only assigned professor/admin can forward' });
    }

    request.forwardedTo = forwardedTo;
    request.forwardMessage = message ? String(message).trim() : '';
    request.status = 'Forwarded';
    await request.save();

    res.json({ message: 'Request forwarded successfully', request });
  } catch (err) {
    next(err);
  }
};

