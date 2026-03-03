const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['Student', 'Faculty', 'Admin'],
      required: true
    },
    facultyRole: {
      type: String,
      enum: ['NONE', 'CLUB_INCHARGE', 'HOD', 'ASSOCIATE_DEAN'],
      default: 'NONE'
    },
    rollNumber: {
      type: String,
      unique: true,
      sparse: true,
      required: function requiredRollNumber() {
        return this.role === 'Student';
      }
    },
    facultyId: {
      type: String,
      unique: true,
      sparse: true,
      required: function requiredFacultyId() {
        return this.role === 'Faculty';
      }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

