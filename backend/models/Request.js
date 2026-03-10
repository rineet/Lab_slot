const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    cc: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    bcc: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    subject: {
      type: String,
      required: true,
      trim: true
    },
    shortMessage: {
      type: String,
      trim: true,
      default: ''
    },
    documentPath: {
      type: String,
      required: true
    },
    approvalType: {
      type: String,
      enum: ['approval'],
      default: 'approval'
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Forwarded'],
      default: 'Pending'
    },
    forwardedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    forwardMessage: {
      type: String,
      trim: true,
      default: ''
    },
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Request', requestSchema);
