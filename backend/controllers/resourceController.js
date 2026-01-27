const Resource = require('../models/Resource');
const { logAction } = require('../utils/auditLogger');

exports.listResources = async (req, res, next) => {
  try {
    const resources = await Resource.find({ isActive: true }).populate('assignedFacultyId', 'name email');
    res.json(resources);
  } catch (err) {
    next(err);
  }
};

exports.createResource = async (req, res, next) => {
  try {
    const { name, type, location, description, assignedFacultyId, capacity } = req.body;
    if (!assignedFacultyId) {
      return res.status(400).json({ message: 'assignedFacultyId is required' });
    }
    const resource = await Resource.create({ name, type, location, description, assignedFacultyId, capacity });
    await logAction({
      actorId: req.user.id,
      action: 'resource_create',
      entityType: 'Resource',
      entityId: resource._id
    });
    res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
};

exports.updateResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findByIdAndUpdate(id, req.body, { new: true });
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    await logAction({
      actorId: req.user.id,
      action: 'resource_update',
      entityType: 'Resource',
      entityId: resource._id
    });
    res.json(resource);
  } catch (err) {
    next(err);
  }
};

exports.deleteResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    await logAction({
      actorId: req.user.id,
      action: 'resource_delete',
      entityType: 'Resource',
      entityId: resource._id
    });
    res.json({ message: 'Resource deactivated' });
  } catch (err) {
    next(err);
  }
};

