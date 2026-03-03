const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectCode: { type: String, required: true },
    month: { type: String, required: true }, // e.g. 2026-02
    totalClasses: { type: Number, required: true },
    attendedClasses: { type: Number, required: true },
    percentage: { type: Number, required: true },
    published: { type: Boolean, default: false }
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, subjectCode: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

