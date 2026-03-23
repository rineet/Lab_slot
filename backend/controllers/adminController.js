const bcrypt = require('bcrypt');
const { parseFirstSheetBuffer } = require('../utils/excelParser');
const User = require('../models/User');
const Policy = require('../models/Policy');
const Attendance = require('../models/Attendance');
const AuditLog = require('../models/AuditLog');
const Complaint = require('../models/Complaint');
const Marks = require('../models/Marks');
const Resource = require('../models/Resource');
const SlotRequest = require('../models/SlotRequest');
const { logAction } = require('../utils/auditLogger');
const { sendMail } = require('../utils/mailer');

const normalizeKey = (key) => String(key || '').toLowerCase().replace(/\s|_/g, '');
const getField = (row, fieldName) => {
  const target = normalizeKey(fieldName);
  const matchKey = Object.keys(row).find((k) => normalizeKey(k) === target);
  return matchKey ? row[matchKey] : undefined;
};

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function sendQueuedEmails(emailJobs, label) {
  if (!emailJobs.length) return;

  const settled = await Promise.allSettled(
    emailJobs.map((job) =>
      sendMail({
        to: job.to,
        subject: job.subject,
        text: job.text
      })
    )
  );

  const failures = settled.filter((item) => item.status === 'rejected');
  if (failures.length) {
    console.warn(`[bulk-${label}] ${failures.length}/${emailJobs.length} emails failed to send`);
  }
}

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
    const updates = { role };
    if (role && role !== 'Faculty') {
      updates.facultyRole = 'NONE';
    }
    const user = await User.findByIdAndUpdate(id, updates, { new: true });
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
    const allowed = ['role', 'isActive', 'facultyRole'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
    }
    const existing = await User.findById(id);
    if (!existing) return res.status(404).json({ message: 'User not found' });
    const nextRole = updates.role || existing.role;
    if (Object.prototype.hasOwnProperty.call(updates, 'facultyRole') && nextRole !== 'Faculty') {
      updates.facultyRole = 'NONE';
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

// Admin: bulk create students via Excel
// Expected columns: email, rollNumber, name (optional)
exports.bulkCreateStudents = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const rows = await parseFirstSheetBuffer(req.file.buffer);

    const results = { created: 0, skipped: 0, errors: [] };
    const emailJobs = [];

    for (const row of rows) {
      const rawEmail = getField(row, 'Email');
      const rawRollNumber =
        getField(row, 'Roll Number') ||
        getField(row, 'Roll No') ||
        getField(row, 'Roll no') ||
        getField(row, 'rollNumber');
      const rawName = getField(row, 'Name');

      const email = String(rawEmail || '').trim().toLowerCase();
      const rollNumber = String(rawRollNumber || '').trim();
      const name = String(rawName || '').trim() || `Student ${rollNumber}`;

      if (!email || !rollNumber) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      const existing = await User.findOne({ $or: [{ email }, { rollNumber }] });
      if (existing) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      const plainPassword = generatePassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      const user = await User.create({
        name,
        email,
        passwordHash,
        role: 'Student',
        rollNumber
      });
      emailJobs.push({
        to: email,
        subject: 'CampusFlow Student Account',
        text: `Hello ${name},\n\nYour student account has been created.\nEmail: ${email}\nRoll Number: ${rollNumber}\nTemporary Password: ${plainPassword}\n\nPlease login and change your password.`
      });
      await logAction({
        actorId: req.user.id,
        action: 'student_bulk_create',
        entityType: 'User',
        entityId: user._id,
        metadata: { email, rollNumber }
      });
      results.created += 1;
    }

    res.json({ ...results, emailQueued: emailJobs.length });
    void sendQueuedEmails(emailJobs, 'students');
    return null;
  } catch (err) {
    return next(err);
  }
};

// Admin: bulk create faculty via Excel
// Expected columns: email, facultyId, name
exports.bulkCreateFaculty = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const rows = await parseFirstSheetBuffer(req.file.buffer);

    const results = { created: 0, skipped: 0, errors: [] };
    const emailJobs = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const row of rows) {
      const rawEmail = getField(row, 'Email');
      const rawFacultyId =
        getField(row, 'Faculty ID') ||
        getField(row, 'Faculty Id') ||
        getField(row, 'facultyId') ||
        getField(row, 'FacultyID');
      const rawName = getField(row, 'Name');

      const email = String(rawEmail || '').trim().toLowerCase();
      const facultyId = String(rawFacultyId || '').trim();
      const name = String(rawName || '').trim() || `Faculty ${facultyId}`;

      if (!email || !facultyId) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      const existing = await User.findOne({ $or: [{ email }, { facultyId }] });
      if (existing) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      const plainPassword = generatePassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      const user = await User.create({
        name,
        email,
        passwordHash,
        role: 'Faculty',
        facultyId
      });
      emailJobs.push({
        to: email,
        subject: 'CampusFlow Faculty Account',
        text: `Hello ${name},\n\nYour faculty account has been created.\nEmail: ${email}\nFaculty ID: ${facultyId}\nTemporary Password: ${plainPassword}\n\nPlease login and change your password.`
      });
      await logAction({
        actorId: req.user.id,
        action: 'faculty_bulk_create',
        entityType: 'User',
        entityId: user._id,
        metadata: { email, facultyId }
      });
      results.created += 1;
    }

    res.json({ ...results, emailQueued: emailJobs.length });
    void sendQueuedEmails(emailJobs, 'faculty');
    return null;
  } catch (err) {
    return next(err);
  }
};

// Admin: create faculty with auto password
exports.createFaculty = async (req, res, next) => {
  try {
    const { name, email, facultyId } = req.body;
    if (!name || !email || !facultyId) {
      return res.status(400).json({ message: 'name, email and facultyId are required' });
    }
    const existing = await User.findOne({ $or: [{ email }, { facultyId }] });
    if (existing) {
      return res.status(400).json({ message: 'Email or facultyId already registered' });
    }
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'Faculty',
      facultyId
    });
    await sendMail({
      to: email,
      subject: 'CampusFlow Faculty Account',
      text: `Hello ${name},\n\nYour faculty account has been created.\nEmail: ${email}\nFaculty ID: ${facultyId}\nTemporary Password: ${plainPassword}\n\nPlease login and change your password.`
    });
    await logAction({
      actorId: req.user.id,
      action: 'faculty_create',
      entityType: 'User',
      entityId: user._id,
      metadata: { email, facultyId }
    });
    return res.status(201).json({ id: user._id });
  } catch (err) {
    return next(err);
  }
};

// Admin: purge all data except admins
exports.purgeAllExceptAdmins = async (req, res, next) => {
  try {
    await Attendance.deleteMany({});
    await Marks.deleteMany({});
    await Complaint.deleteMany({});
    await Resource.deleteMany({});
    await SlotRequest.deleteMany({});
    await Policy.deleteMany({});
    await AuditLog.deleteMany({});
    await User.deleteMany({ role: { $ne: 'Admin' } });

    await logAction({
      actorId: req.user.id,
      action: 'purge_data',
      entityType: 'System',
      entityId: 'ALL'
    });

    return res.json({ message: 'Data purged. Admin accounts retained.' });
  } catch (err) {
    return next(err);
  }
};
