const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const JWT_EXPIRES_IN = '2h';

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2 * 60 * 60 * 1000
});

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, supervisorId, rollNumber } = req.body;
    console.log(req.body);
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (role === 'Student' && !rollNumber) {
      return res.status(400).json({ message: 'rollNumber is required for students' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    if (rollNumber) {
      const existingRoll = await User.findOne({ rollNumber });
      if (existingRoll) {
        return res.status(400).json({ message: 'Roll number already registered' });
      }
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      rollNumber: rollNumber || null,
      supervisorId: supervisorId || null
    });
    await logAction({ actorId: user._id, action: 'register', entityType: 'User', entityId: user._id, metadata: { role } });
    const token = signToken(user);
    res.cookie('token', token, cookieOptions());
    res.status(201).json({
      user: { id: user._id, name: user.name, role: user.role, email: user.email, rollNumber: user.rollNumber || null }
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = signToken(user);
    await logAction({ actorId: user._id, action: 'login', entityType: 'User', entityId: user._id });
    res.cookie('token', token, cookieOptions());
    res.json({
      user: { id: user._id, name: user.name, role: user.role, email: user.email, rollNumber: user.rollNumber || null }
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
      user: { id: user._id, name: user.name, role: user.role, email: user.email, rollNumber: user.rollNumber || null }
    });
  } catch (err) {
    return next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All password fields are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    await logAction({ actorId: user._id, action: 'change_password', entityType: 'User', entityId: user._id });
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return next(err);
  }
};

