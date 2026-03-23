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
      default: ''
    },
    documentName: {
      type: String,
      default: 'document.pdf',
      trim: true
    },
    documentMimeType: {
      type: String,
      default: 'application/pdf'
    },
    documentSize: {
      type: Number,
      default: 0,
      min: 0
    },
    documentData: {
      type: Buffer
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

requestSchema.index({ studentId: 1, createdAt: -1 });
requestSchema.index({ to: 1, createdAt: -1 });
requestSchema.index({ cc: 1, createdAt: -1 });
requestSchema.index({ bcc: 1, createdAt: -1 });
requestSchema.index({ forwardedTo: 1, createdAt: -1 });

module.exports = mongoose.model('Request', requestSchema);
