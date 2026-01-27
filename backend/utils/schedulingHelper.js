const SlotRequest = require('../models/SlotRequest');

// Check for overlap: (new.start < existing.end) AND (new.end > existing.start)
async function checkResourceConflict(resourceId, startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const overlapping = await SlotRequest.findOne({
    resourceId,
    status: 'APPROVED',
    startTime: { $lt: end },
    endTime: { $gt: start }
  });

  if (overlapping) {
    throw new Error('Requested slot conflicts with an existing approved slot');
  }
}

module.exports = { checkResourceConflict };

