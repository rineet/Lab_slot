const Complaint = require('../models/Complaint');
const { logAction } = require('../utils/auditLogger');

exports.createComplaint = async (req, res, next) => {
  try {
    const { venueId, category, description } = req.body;
    if (!venueId || !category || !description) {
      return res.status(400).json({ message: 'venueId, category and description required' });
    }
    const complaint = await Complaint.create({
      raisedBy: req.user.id,
      venueId,
      category,
      description
    });
    await logAction({
      actorId: req.user.id,
      action: 'complaint_create',
      entityType: 'Complaint',
      entityId: complaint._id
    });
    res.status(201).json(complaint);
  } catch (err) {
    next(err);
  }
};

exports.getMyComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find({ raisedBy: req.user.id }).populate('venueId');
    res.json(complaints);
  } catch (err) {
    next(err);
  }
};

exports.listComplaints = async (req, res, next) => {
  try {
    const complaints = await Complaint.find().populate('raisedBy venueId assignedTo');
    res.json(complaints);
  } catch (err) {
    next(err);
  }
};

exports.getFacultyComplaints = async (req, res, next) => {
  try {
    // Get complaints for resources assigned to this faculty
    const Resource = require('../models/Resource');
    const resources = await Resource.find({ assignedFacultyId: req.user.id });
    const resourceIds = resources.map(r => r._id);
    
    const complaints = await Complaint.find({
      $or: [
        { venueId: { $in: resourceIds } },
        { assignedTo: req.user.id }
      ]
    }).populate('raisedBy venueId assignedTo');
    
    res.json(complaints);
  } catch (err) {
    next(err);
  }
};

exports.updateComplaintStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    if (status) {
      complaint.status = status;
    }
    if (assignedTo !== undefined) {
      complaint.assignedTo = assignedTo || null;
    }
    await complaint.save();
    await logAction({
      actorId: req.user.id,
      action: 'complaint_update',
      entityType: 'Complaint',
      entityId: complaint._id,
      metadata: { status, assignedTo }
    });
    res.json(complaint);
  } catch (err) {
    next(err);
  }
};

