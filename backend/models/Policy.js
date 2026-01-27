const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
  {
    maxHoursPerDay: { type: Number, default: 4 },
    maxHoursPerWeek: { type: Number, default: 12 },
    maxActiveRequests: { type: Number, default: 3 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Policy', policySchema);

