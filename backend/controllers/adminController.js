const User = require('../models/User');
const Policy = require('../models/Policy');
const { logAction } = require('../utils/auditLogger');

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.changeRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    await logAction({
      actorId: req.user.id,
      action: 'user_role_change',
      entityType: 'User',
      entityId: user._id,
      metadata: { role }
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updatePolicy = async (req, res, next) => {
  try {
    let policy = await Policy.findOne();
    if (!policy) {
      policy = await Policy.create(req.body);
    } else {
      policy = await Policy.findByIdAndUpdate(policy._id, req.body, { new: true });
    }
    await logAction({
      actorId: req.user.id,
      action: 'policy_change',
      entityType: 'Policy',
      entityId: policy._id,
      metadata: req.body
    });
    res.json(policy);
  } catch (err) {
    next(err);
  }
};

exports.getPolicy = async (req, res, next) => {
  try {
    let policy = await Policy.findOne();
    if (!policy) {
      policy = await Policy.create({});
    }
    res.json(policy);
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowed = ['role', 'isActive'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logAction({
      actorId: req.user.id,
      action: 'user_update',
      entityType: 'User',
      entityId: user._id,
      metadata: updates
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
};
