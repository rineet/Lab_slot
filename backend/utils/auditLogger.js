const AuditLog = require('../models/AuditLog');

async function logAction({ actorId, action, entityType, entityId, metadata = {} }) {
  try {
    await AuditLog.create({
      actorId,
      action,
      entityType,
      entityId,
      metadata
    });
  } catch (err) {
    // Do not crash the request on logging failure, just log to console
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAction };

