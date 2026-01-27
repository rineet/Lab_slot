const User = require('../models/User');

exports.listFaculty = async (req, res, next) => {
  try {
    const faculty = await User.find({ role: 'Faculty', isActive: true }).select('_id name email');
    res.json(faculty);
  } catch (err) {
    next(err);
  }
};

