const SlotRequest = require('../models/SlotRequest');
const Resource = require('../models/Resource');
const User = require('../models/User');
const { checkStudentQuota } = require('../utils/policyHelper');
const { checkResourceConflict } = require('../utils/schedulingHelper');
const { logAction } = require('../utils/auditLogger');

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
    const { resourceId, startTime, endTime, purpose, attendees } = req.body;
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

    const slot = await SlotRequest.create({
      studentId,
      facultyId,
      resourceId,
      startTime,
      endTime,
      purpose,
      attendees,
      status: 'PENDING'
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
    const slots = await SlotRequest.find({ resourceId: id }).populate('studentId facultyId');
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
    const slots = await SlotRequest.find({ facultyId: req.user.id, status: 'PENDING' })
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

    ensureFutureStart(slot.startTime);
    ensureEndAfterStart(slot.startTime, slot.endTime);
    await checkResourceConflict(slot.resourceId, slot.startTime, slot.endTime);

    slot.status = 'APPROVED';
    slot.decisionReason = req.body.reason || '';
    await slot.save();

    await logAction({
      actorId: req.user.id,
      action: 'request_approve',
      entityType: 'SlotRequest',
      entityId: slot._id
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

