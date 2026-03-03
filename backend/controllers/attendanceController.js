const xlsx = require('xlsx');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

const normalizeKey = (key) => String(key || '').toLowerCase().replace(/\s|_/g, '');
const getField = (row, fieldName) => {
  const target = normalizeKey(fieldName);
  const matchKey = Object.keys(row).find((k) => normalizeKey(k) === target);
  return matchKey ? row[matchKey] : undefined;
};

// Faculty: upload attendance via Excel (one sheet)
// Expected columns: rollNumber, attendance
exports.uploadAttendance = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const { subjectCode: bodySubjectCode, month: bodyMonth, totalClasses: bodyTotalClasses } = req.body;
    const defaultTotal = bodyTotalClasses !== undefined ? Number(bodyTotalClasses) : null;
    if (defaultTotal !== null && (Number.isNaN(defaultTotal) || defaultTotal <= 0)) {
      return res.status(400).json({ message: 'totalClasses must be a positive number' });
    }
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const results = { inserted: 0, updated: 0, skipped: 0, errors: [] };

    // eslint-disable-next-line no-restricted-syntax
    // console.log(rows);
    for (const row of rows) {
      const rollNumber = getField(row, 'Roll Number');
      const attendanceValue = getField(row, 'Attendance') ?? getField(row, 'Attended Classes');
      const subjectCode = bodySubjectCode || getField(row, 'Subject Code');
      const month = bodyMonth || getField(row, 'Month');
      const rowTotal = defaultTotal !== null ? defaultTotal : getField(row, 'Total Classes');
      
      if (!rollNumber || attendanceValue === null || attendanceValue === undefined || !subjectCode || !month) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      // console.log(rollNumber, attendanceValue, subjectCode, month, rowTotal,Number.isNaN(rowTotal),Number.isNaN(attendanceValue));
      const total = Number(rowTotal);
      const attended = Number(attendanceValue);
      // if (!Number.isNaN(total) || !Number.isNaN(attended) || total <= 0 || attended < 0 || attended > total) {
      //   results.skipped += 1;
      //   // eslint-disable-next-line no-continue
      //   continue;
      // }
      const percentage = (attended / total) * 100;
      try {
        const student = await User.findOne({ rollNumber, role: 'Student' });
        // console.log(student);
        if (!student) {
          results.skipped += 1;
          results.errors.push(`No student found for rollNumber ${rollNumber}`);
          // eslint-disable-next-line no-continue
          continue;
        }
        const existing = await Attendance.findOne({ studentId: student._id, subjectCode, month });
        if (existing && existing.published) {
          results.skipped += 1;
          // eslint-disable-next-line no-continue
          // console.log("hello");
          continue;
        }
        if (existing) {
          existing.totalClasses = total;
          existing.attendedClasses = attended;
          existing.percentage = percentage;
          await existing.save();
          results.updated += 1;
        } else {
          await Attendance.create({
            studentId: student._id,
            subjectCode,
            month,
            totalClasses: total,
            attendedClasses: attended,
            percentage,
            published: false
          });
          results.inserted += 1;
        }
      } catch (err) {
        results.errors.push(err.message);
      }
    }
    res.json(results);
  } catch (err) {
    next(err);
  }
};

// Faculty: publish attendance (locks records)
exports.publishAttendance = async (req, res, next) => {
  try {
    const { subjectCode, month } = req.body;
    if (!subjectCode || !month) {
      return res.status(400).json({ message: 'subjectCode and month required' });
    }
    await Attendance.updateMany({ subjectCode, month }, { $set: { published: true } });
    res.json({ message: 'Attendance published' });
  } catch (err) {
    next(err);
  }
};

// Student: view own attendance
exports.getMyAttendance = async (req, res, next) => {
  try {
    const records = await Attendance.find({ studentId: req.user.id, published: true });
    res.json(records);
  } catch (err) {
    next(err);
  }
};

