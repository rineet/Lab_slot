const { parseFirstSheetBuffer } = require('../utils/excelParser');
const Marks = require('../models/Marks');
const User = require('../models/User');
const mongoose = require('mongoose');

const normalizeKey = (key) => String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const getAnyField = (row, fieldNames) => {
  const aliases = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  const targets = aliases.map((name) => normalizeKey(name));
  const matchKey = Object.keys(row).find((k) => targets.includes(normalizeKey(k)));
  return matchKey ? row[matchKey] : undefined;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeToken = (value) => String(value || '').trim();

// Faculty: upload marks via Excel
// Expected columns: Roll Number, Subject Code, Assessment Type, Max Marks, Obtained Marks
// Backward-compatible header: Student ID (treated as roll number)
exports.uploadMarks = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let rows = [];
    try {
      rows = await parseFirstSheetBuffer(req.file.buffer);
    } catch (err) {
      return res.status(400).json({
        message: 'Invalid or corrupted Excel file. Please upload a valid .xlsx file with headers: Roll Number, Subject Code, Assessment Type, Max Marks, Obtained Marks.'
      });
    }

    if (!rows.length) {
      return res.status(400).json({
        message: 'No data rows found in Excel file. Please ensure row 1 has headers and data starts from row 2.'
      });
    }

    const results = { inserted: 0, skipped: 0, errors: [] };

    // eslint-disable-next-line no-restricted-syntax
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNo = index + 2; // Excel row number (header is row 1)

      const rollNumberRaw = getAnyField(row, [
        'Roll Number',
        'Roll No',
        'Roll Num',
        'Roll Numb',
        'Student ID'
      ]);
      const subjectCodeRaw = getAnyField(row, ['Subject Code', 'Subject Co', 'Subject']);
      const assessmentTypeRaw = getAnyField(row, [
        'Assessment Type',
        'Assesment Type',
        'Assesment',
        'Assessment'
      ]);
      const maxMarksRaw = getAnyField(row, ['Max Marks', 'Max Mark']);
      const obtainedMarksRaw = getAnyField(row, ['Obtained Marks', 'Obtained Mark', 'Marks Obtained']);

      const rollNumber = String(rollNumberRaw || '').trim();
      const subjectCode = String(subjectCodeRaw || '').trim();
      const assessmentType = String(assessmentTypeRaw || '').trim();

      if (!rollNumber || !subjectCode || !assessmentType) {
        results.skipped += 1;
        results.errors.push(
          `Row ${rowNo}: missing Roll Number / Subject Code / Assessment Type (accepted aliases are supported).`
        );
        // eslint-disable-next-line no-continue
        continue;
      }

      const max = Number(maxMarksRaw);
      const obtained = Number(obtainedMarksRaw);
      if (Number.isNaN(max) || Number.isNaN(obtained) || max <= 0 || obtained < 0 || obtained > max) {
        results.skipped += 1;
        results.errors.push(`Row ${rowNo}: invalid marks. Check Max Marks and Obtained Marks values.`);
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        const student = await User.findOne({
          role: 'Student',
          rollNumber: { $regex: `^${escapeRegex(rollNumber)}$`, $options: 'i' }
        }).select('_id');
        if (!student) {
          results.skipped += 1;
          results.errors.push(`Row ${rowNo}: no student found for roll number ${rollNumber}`);
          // eslint-disable-next-line no-continue
          continue;
        }

        // Latest version
        const latest = await Marks.findOne({ studentId: student._id, subjectCode, assessmentType })
          .sort({ version: -1 })
          .limit(1);
        const version = latest ? latest.version + 1 : 1;
        await Marks.create({
          studentId: student._id,
          subjectCode,
          assessmentType,
          maxMarks: max,
          obtainedMarks: obtained,
          published: false,
          version
        });
        results.inserted += 1;
      } catch (err) {
        results.errors.push(err.message);
      }
    }
    res.json(results);
  } catch (err) {
    next(err);
  }
};

// Faculty: publish marks (marks become visible and immutable)
exports.publishMarks = async (req, res, next) => {
  try {
    const subjectCode = normalizeToken(req.body.subjectCode);
    const assessmentType = normalizeToken(req.body.assessmentType);
    if (!subjectCode || !assessmentType) {
      return res.status(400).json({ message: 'subjectCode and assessmentType required' });
    }

    const subjectRegex = new RegExp(`^${escapeRegex(subjectCode)}$`, 'i');
    const assessmentRegex = new RegExp(`^${escapeRegex(assessmentType)}$`, 'i');

    // Only latest version per student becomes published
    const latestPerStudent = await Marks.aggregate([
      { $match: { subjectCode: subjectRegex, assessmentType: assessmentRegex } },
      {
        $sort: { version: -1 }
      },
      {
        $group: {
          _id: '$studentId',
          latestId: { $first: '$_id' }
        }
      }
    ]);
    const latestIds = latestPerStudent.map((d) => d.latestId);
    await Marks.updateMany({ _id: { $in: latestIds } }, { $set: { published: true } });
    res.json({
      message: 'Marks published',
      count: latestIds.length,
      subjectCode,
      assessmentType
    });
  } catch (err) {
    next(err);
  }
};

// Student: view own marks (only published latest version)
exports.getMyMarks = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      return res.status(400).json({ message: 'Invalid student id' });
    }

    const studentObjectId = new mongoose.Types.ObjectId(req.user.id);


    const records = await Marks.aggregate([
      { $match: { studentId: studentObjectId, published: true } },
      { $sort: { version: -1 } },
      {
        $group: {
          _id: { subjectCode: '$subjectCode', assessmentType: '$assessmentType' },
          doc: { $first: '$$ROOT' }
        }
      }
    ]);
    console.log('Fetched marks for student', req.user.id, records);
    res.json(records.map((r) => r.doc));
  } catch (err) {
    next(err);
  }
};
