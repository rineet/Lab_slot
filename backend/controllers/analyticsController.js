const SlotRequest = require('../models/SlotRequest');
const Resource = require('../models/Resource');
const User = require('../models/User');

// Venue utilization: approved booking hours per resource
exports.venueUtilization = async (req, res, next) => {
  try {
    const slots = await SlotRequest.find({ status: 'APPROVED' }).populate('resourceId');
    const usage = {};
    slots.forEach((s) => {
      if (!s.resourceId) return;
      const id = String(s.resourceId._id);
      const hours = (new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60 * 60);
      if (!usage[id]) {
        usage[id] = {
          resourceId: id,
          name: s.resourceId.name,
          type: s.resourceId.type,
          location: s.resourceId.location,
          hoursBooked: 0,
          bookingCount: 0
        };
      }
      usage[id].hoursBooked += hours;
      usage[id].bookingCount += 1;
    });
    res.json(Object.values(usage).sort((a, b) => b.hoursBooked - a.hoursBooked));
  } catch (err) {
    next(err);
  }
};

// Faculty workload: count of approved bookings per faculty with faculty name
exports.facultyWorkload = async (req, res, next) => {
  try {
    const data = await SlotRequest.aggregate([
      { $match: { status: 'APPROVED' } },
      {
        $group: {
          _id: '$facultyId',
          approvedCount: { $sum: 1 },
          totalHours: {
            $sum: {
              $divide: [
                { $subtract: ['$endTime', '$startTime'] },
                3600000
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'facultyData'
        }
      },
      {
        $unwind: {
          path: '$facultyData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          facultyId: '$_id',
          facultyName: { $ifNull: ['$facultyData.name', 'Unknown Faculty'] },
          facultyEmail: '$facultyData.email',
          approvedCount: 1,
          totalHours: { $round: ['$totalHours', 2] }
        }
      },
      { $sort: { approvedCount: -1 } }
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

