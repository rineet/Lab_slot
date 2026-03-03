const SlotRequest = require('../models/SlotRequest');
const Resource = require('../models/Resource');
const User = require('../models/User');
const { checkStudentQuota } = require('../utils/policyHelper');
const { checkResourceConflict } = require('../utils/schedulingHelper');
const { logAction } = require('../utils/auditLogger');

const approvalOrder = ['CLUB_INCHARGE', 'HOD', 'ASSOCIATE_DEAN'];

function getNextStage(currentStage) {
  const idx = approvalOrder.indexOf(currentStage);
  if (idx === -1) return 'FINAL';
  return approvalOrder[idx + 1] || 'FINAL';
}

function normalizeApprovalStage(slot) {
  if (slot.requiresClubApproval && slot.approvalStage === 'FACULTY') {
    return 'CLUB_INCHARGE';
  }
  return slot.approvalStage;
}

async function canApproveSlot(slot, userId, userRole) {
  if (userRole === 'Admin') return true;
  const stage = normalizeApprovalStage(slot);
  if (stage === 'FACULTY') return String(slot.facultyId) === String(userId);
  const user = await User.findById(userId).select('facultyRole');
  if (!user) return false;
  return user.facultyRole === stage;
}

async function expireIfPast(slot) {
  if (slot.status === 'APPROVED' || slot.status === 'PENDING') {
    if (new Date(slot.endTime) < new Date()) {
      slot.status = 'EXPIRED';
      await slot.save();
    }
  }
}

function ensureFutureStart(startTime) {
  if (new Date(startTime) <= new Date()) {
    throw new Error('Start time must be in the future');
  }
}

function ensureEndAfterStart(startTime, endTime) {
  if (new Date(endTime) <= new Date(startTime)) {
    throw new Error('End time must be after start time');
  }
}

exports.createSlotRequest = async (req, res, next) => {
  try {
    const { resourceId, startTime, endTime, purpose, attendees, isClubBooking } = req.body;
    const studentId = req.user.id;

    ensureFutureStart(startTime);
    ensureEndAfterStart(startTime, endTime);

    const resource = await Resource.findById(resourceId);
    if (!resource || !resource.isActive) {
      return res.status(400).json({ message: 'Resource not active' });
    }

    if (attendees > resource.capacity) {
      return res.status(400).json({ message: `Attendees count (${attendees}) exceeds resource capacity (${resource.capacity})` });
    }

    const facultyId = resource.assignedFacultyId;
    if (!facultyId) {
      return res.status(400).json({ message: 'Resource has no assigned faculty' });
    }

    await checkStudentQuota(studentId, startTime, endTime);
    await checkResourceConflict(resourceId, startTime, endTime);

    const clubBooking = Boolean(isClubBooking);
    const slot = await SlotRequest.create({
      studentId,
      facultyId,
      resourceId,
      startTime,
      endTime,
      purpose,
      attendees,
      status: 'PENDING',
      requiresClubApproval: clubBooking,
      approvalStage: clubBooking ? 'CLUB_INCHARGE' : 'FACULTY'
    });

    await logAction({
      actorId: studentId,
      action: 'request_create',
      entityType: 'SlotRequest',
      entityId: slot._id
    });

    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
};

exports.cancelSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await SlotRequest.findById(id);
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    if (String(slot.studentId) !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not allowed to cancel' });
    }
    slot.status = 'CANCELLED';
    await slot.save();
    await logAction({
      actorId: req.user.id,
      action: 'request_cancel',
      entityType: 'SlotRequest',
      entityId: slot._id
    });
    res.json({ message: 'Cancelled', slot });
  } catch (err) {
    next(err);
  }
};

exports.getMyRequests = async (req, res, next) => {
  try {
    const slots = await SlotRequest.find({ studentId: req.user.id }).populate('resourceId');
    for (const slot of slots) {
      // eslint-disable-next-line no-await-in-loop
      await expireIfPast(slot);
    }
    res.json(slots);
  } catch (err) {
    next(err);
  }
};

exports.getResourceCalendar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slots = await SlotRequest.find({ resourceId: id }).populate('studentId facultyId resourceId');
    for (const slot of slots) {
      // eslint-disable-next-line no-await-in-loop
      await expireIfPast(slot);
    }
    res.json(slots);
  } catch (err) {
    next(err);
  }
};

exports.getFacultyPending = async (req, res, next) => {
  try {
    if (req.user.role === 'Admin') {
      const adminSlots = await SlotRequest.find({ status: 'PENDING' }).populate('studentId resourceId');
      return res.json(adminSlots);
    }

    const user = await User.findById(req.user.id).select('facultyRole');
    const stageMatches = [];
    if (user?.facultyRole === 'CLUB_INCHARGE') stageMatches.push('CLUB_INCHARGE');
    if (user?.facultyRole === 'HOD') stageMatches.push('HOD');
    if (user?.facultyRole === 'ASSOCIATE_DEAN') stageMatches.push('ASSOCIATE_DEAN');

    const orClauses = [{ approvalStage: 'FACULTY', facultyId: req.user.id }];
    if (stageMatches.length) {
      orClauses.push({ approvalStage: { $in: stageMatches } });
      if (stageMatches.includes('CLUB_INCHARGE')) {
        orClauses.push({ approvalStage: 'FACULTY', requiresClubApproval: true });
      }
    }

    const slots = await SlotRequest.find({ status: 'PENDING', $or: orClauses })
      .populate('studentId resourceId');
    res.json(slots);
  } catch (err) {
    next(err);
  }
};

exports.approveSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await SlotRequest.findById(id);
    if (!slot) return res.status(404).json({ message: 'Slot not found' });

    const allowed = await canApproveSlot(slot, req.user.id, req.user.role);
    if (!allowed) return res.status(403).json({ message: 'Not authorized to approve this request' });

    const currentStage = normalizeApprovalStage(slot);
    if (currentStage !== slot.approvalStage) {
      slot.approvalStage = currentStage;
    }
    const nextStage = slot.requiresClubApproval ? getNextStage(currentStage) : 'FINAL';
    const isFinalApproval = nextStage === 'FINAL';
    if (isFinalApproval) {
      ensureFutureStart(slot.startTime);
      ensureEndAfterStart(slot.startTime, slot.endTime);
      await checkResourceConflict(slot.resourceId, slot.startTime, slot.endTime);
    }

    if (isFinalApproval) {
      slot.status = 'APPROVED';
      slot.approvalStage = 'FINAL';
      slot.decisionReason = req.body.reason || '';
      await slot.save();
    } else {
      slot.status = 'PENDING';
      slot.approvalStage = nextStage;
      slot.decisionReason = req.body.reason || '';
      await slot.save();
    }

    await logAction({
      actorId: req.user.id,
      action: isFinalApproval ? 'request_approve' : 'request_approve_stage',
      entityType: 'SlotRequest',
      entityId: slot._id,
      metadata: isFinalApproval ? {} : { nextStage: slot.approvalStage }
    });

    res.json(slot);
  } catch (err) {
    next(err);
  }
};

exports.rejectSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await SlotRequest.findById(id);
    if (!slot) return res.status(404).json({ message: 'Slot not found' });

    const allowed = await canApproveSlot(slot, req.user.id, req.user.role);
    if (!allowed) return res.status(403).json({ message: 'Not authorized to reject this request' });

    slot.status = 'REJECTED';
    slot.decisionReason = req.body.reason || '';
    await slot.save();

    await logAction({
      actorId: req.user.id,
      action: 'request_reject',
      entityType: 'SlotRequest',
      entityId: slot._id
    });

    res.json(slot);
  } catch (err) {
    next(err);
  }
};

