const Policy = require('../models/Policy');
const SlotRequest = require('../models/SlotRequest');

async function getCurrentPolicy() {
  let policy = await Policy.findOne();
  if (!policy) {
    policy = await Policy.create({});
  }
  return policy;
}

async function checkStudentQuota(studentId, startTime, endTime) {
  const policy = await getCurrentPolicy();
  const start = new Date(startTime);
  const end = new Date(endTime);
  const hoursRequested = (end - start) / (1000 * 60 * 60);

  // Day range
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(start);
  dayEnd.setHours(23, 59, 59, 999);

  // Week range (simple: 7 days around given day)
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // beginning of week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const activeStatuses = ['CREATED', 'PENDING', 'APPROVED'];

  const dayRequests = await SlotRequest.find({
    studentId,
    status: { $in: activeStatuses },
    startTime: { $gte: dayStart, $lt: dayEnd }
  });

  const weekRequests = await SlotRequest.find({
    studentId,
    status: { $in: activeStatuses },
    startTime: { $gte: weekStart, $lt: weekEnd }
  });

  const activeRequestsCount = await SlotRequest.countDocuments({
    studentId,
    status: { $in: activeStatuses }
  });

  const sumHours = (reqs) =>
    reqs.reduce((sum, r) => {
      const dur = (new Date(r.endTime) - new Date(r.startTime)) / (1000 * 60 * 60);
      return sum + (isNaN(dur) ? 0 : dur);
    }, 0);

  const dayHours = sumHours(dayRequests) + hoursRequested;
  const weekHours = sumHours(weekRequests) + hoursRequested;

  if (dayHours > policy.maxHoursPerDay) {
    throw new Error(`Student exceeds max hours per day. Requested total: ${dayHours.toFixed(1)}h, Max allowed: ${policy.maxHoursPerDay}h`);
  }
  if (weekHours > policy.maxHoursPerWeek) {
    throw new Error(`Student exceeds max hours per week. Requested total: ${weekHours.toFixed(1)}h, Max allowed: ${policy.maxHoursPerWeek}h`);
  }
  if (activeRequestsCount + 1 > policy.maxActiveRequests) {
    throw new Error(`Student exceeds max active requests. Active: ${activeRequestsCount}, Max allowed: ${policy.maxActiveRequests}`);
  }
}

module.exports = { getCurrentPolicy, checkStudentQuota };

