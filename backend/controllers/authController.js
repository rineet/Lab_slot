const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const JWT_EXPIRES_IN = '2h';

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, supervisorId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role, supervisorId: supervisorId || null });
    await logAction({ actorId: user._id, action: 'register', entityType: 'User', entityId: user._id, metadata: { role } });
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
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
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // Stateless JWT logout; client should discard token.
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

