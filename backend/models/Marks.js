const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subjectCode: { type: String, required: true },
    assessmentType: { type: String, required: true }, // e.g. MIDTERM, QUIZ1
    maxMarks: { type: Number, required: true },
    obtainedMarks: { type: Number, required: true },
    published: { type: Boolean, default: false },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

marksSchema.index({ studentId: 1, subjectCode: 1, assessmentType: 1, version: 1 });

module.exports = mongoose.model('Marks', marksSchema);

