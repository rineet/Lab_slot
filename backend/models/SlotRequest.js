const mongoose = require('mongoose');

const slotRequestSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    purpose: { type: String, required: true },
    attendees: { type: Number, required: true },
    status: {
      type: String,
      enum: ['CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
      default: 'CREATED'
    },
    requiresClubApproval: { type: Boolean, default: false },
    approvalStage: {
      type: String,
      enum: ['FACULTY', 'CLUB_INCHARGE', 'HOD', 'ASSOCIATE_DEAN', 'FINAL'],
      default: 'FACULTY'
    },
    decisionReason: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SlotRequest', slotRequestSchema);

