const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['Lab', 'GPU', 'Equipment'], required: true },
    location: { type: String, required: true },
    description: { type: String, default: '' },
    assignedFacultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
    capacity: { type: Number, required: true, default: 30 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);

