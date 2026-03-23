const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseRecipientIds = (value) => {
  if (Array.isArray(value)) return value.map((item) => normalizeString(String(item))).filter(Boolean);
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error('Recipient list must be an array');
    return parsed.map((item) => normalizeString(String(item))).filter(Boolean);
  }

  return [trimmed];
};

const validationMiddleware = (validators = []) => {
  return async (req, res, next) => {
    try {
      for (const validator of validators) {
        // eslint-disable-next-line no-await-in-loop
        await validator(req);
      }
      next();
    } catch (err) {
      return res.status(400).json({ message: err.message || 'Validation failed' });
    }
  };
};

const validateLogin = async (req) => {
  const email = normalizeString(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!EMAIL_REGEX.test(email)) {
    throw new Error('A valid email address is required');
  }

  if (!password.trim()) {
    throw new Error('Password is required');
  }

  req.body.email = email;
};

const validateRegister = async (req) => {
  const name = normalizeString(req.body.name);
  const email = normalizeString(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = normalizeString(req.body.role);
  const rollNumber = normalizeString(req.body.rollNumber);
  const supervisorId = normalizeString(req.body.supervisorId);
  const allowedRoles = ['Student', 'Faculty', 'Admin'];

  if (name.length < 2 || name.length > 80) {
    throw new Error('Name must be between 2 and 80 characters');
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new Error('A valid email address is required');
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number');
  }

  if (!allowedRoles.includes(role)) {
    throw new Error('Role must be Student, Faculty, or Admin');
  }

  if (role === 'Student' && !rollNumber) {
    throw new Error('rollNumber is required for students');
  }

  if (supervisorId && !OBJECT_ID_REGEX.test(supervisorId)) {
    throw new Error('supervisorId must be a valid id');
  }

  req.body.name = name;
  req.body.email = email;
  req.body.role = role;
  req.body.rollNumber = rollNumber || undefined;
  req.body.supervisorId = supervisorId || undefined;
};

const validateChangePassword = async (req) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error('All password fields are required');
  }

  if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
    throw new Error('New password must be at least 8 characters and include uppercase, lowercase, and a number');
  }

  if (newPassword !== confirmPassword) {
    throw new Error('New password and confirmation do not match');
  }

  if (newPassword === currentPassword) {
    throw new Error('New password must be different from current password');
  }
};

const validateDocumentRequest = async (req) => {
  const name = normalizeString(req.body.name);
  const subject = normalizeString(req.body.subject);
  const shortMessage = normalizeString(req.body.shortMessage);
  const to = parseRecipientIds(req.body.to);
  const cc = parseRecipientIds(req.body.cc);
  const bcc = parseRecipientIds(req.body.bcc);
  const allRecipientIds = [...to, ...cc, ...bcc];

  if (!req.file) {
    throw new Error('PDF document is required');
  }

  if (!to.length) {
    throw new Error('Please select at least one recipient in To');
  }

  if (!subject || subject.length > 150) {
    throw new Error('Subject is required and must be 150 characters or fewer');
  }

  if (name && name.length > 80) {
    throw new Error('Name must be 80 characters or fewer');
  }

  if (shortMessage.length > 1000) {
    throw new Error('Message must be 1000 characters or fewer');
  }

  if (allRecipientIds.some((id) => !OBJECT_ID_REGEX.test(id))) {
    throw new Error('One or more recipient ids are invalid');
  }

  req.body.name = name;
  req.body.subject = subject;
  req.body.shortMessage = shortMessage;
  req.body.to = to;
  req.body.cc = cc;
  req.body.bcc = bcc;
};

module.exports = validationMiddleware;
module.exports.validateLogin = validateLogin;
module.exports.validateRegister = validateRegister;
module.exports.validateChangePassword = validateChangePassword;
module.exports.validateDocumentRequest = validateDocumentRequest;
