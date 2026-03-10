const Request = require('../models/Request');
const User = require('../models/User');

async function getStudentProfile(req) {
  const user = await User.findById(req.user.id).select('name');
  return user;
}

exports.listRecipients = async (req, res, next) => {
  try {
    const recipients = await User.find({ role: { $in: ['Faculty', 'Admin'] }, isActive: true }).select(
      '_id name email role'
    );
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
    const parsedCC = cc ? JSON.parse(cc) : [];
    const parsedBCC = bcc ? JSON.parse(bcc) : [];

    const created = await Request.create({
      studentId: req.user.id,
      name: (name || profile?.name || 'Student').trim(),
      to,
      cc: Array.isArray(parsedCC) ? parsedCC : [],
      bcc: Array.isArray(parsedBCC) ? parsedBCC : [],
      subject: subject.trim(),
      shortMessage: shortMessage ? shortMessage.trim() : '',
      documentPath: `/uploads/documents/${req.file.filename}`,
      approvalType: 'approval',
      status: 'Pending'
    });

    return res.status(201).json({ message: 'Request submitted successfully', request: created });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ message: 'Invalid CC/BCC format' });
    }
    return next(err);
  }
};

exports.getStudentRequests = async (req, res, next) => {
  try {
    const rows = await Request.find({ studentId: req.user.id })
      .populate('to', 'name email role')
      .populate('forwardedTo', 'name email role')
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getProfessorInbox = async (req, res, next) => {
  try {
    const myId = req.user.id;
    const rows = await Request.find({
      $or: [{ to: myId }, { cc: myId }, { bcc: myId }, { forwardedTo: myId }]
    })
      .populate('studentId', 'name email rollNumber')
      .populate('to', 'name email role')
      .populate('forwardedTo', 'name email role')
      .sort({ createdAt: -1 });

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
      String(request.to) === String(req.user.id) || String(request.forwardedTo || '') === String(req.user.id);
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
      String(request.to) === String(req.user.id) || String(request.forwardedTo || '') === String(req.user.id);
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
      String(request.to) === String(req.user.id) || String(request.forwardedTo || '') === String(req.user.id);
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

