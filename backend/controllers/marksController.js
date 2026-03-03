const xlsx = require('xlsx');
const Marks = require('../models/Marks');

// Faculty: upload marks via Excel
// Expected columns: studentId, subjectCode, assessmentType, maxMarks, obtainedMarks
exports.uploadMarks = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const results = { inserted: 0, skipped: 0, errors: [] };

    // eslint-disable-next-line no-restricted-syntax
    for (const row of rows) {
      const { studentId, subjectCode, assessmentType, maxMarks, obtainedMarks } = row;
      if (!studentId || !subjectCode || !assessmentType) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      const max = Number(maxMarks);
      const obtained = Number(obtainedMarks);
      if (Number.isNaN(max) || Number.isNaN(obtained) || max <= 0 || obtained < 0 || obtained > max) {
        results.skipped += 1;
        // eslint-disable-next-line no-continue
        continue;
      }
      try {
        // Latest version
        const latest = await Marks.findOne({ studentId, subjectCode, assessmentType })
          .sort({ version: -1 })
          .limit(1);
        const version = latest ? latest.version + 1 : 1;
        await Marks.create({
          studentId,
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
    const { subjectCode, assessmentType } = req.body;
    if (!subjectCode || !assessmentType) {
      return res.status(400).json({ message: 'subjectCode and assessmentType required' });
    }
    // Only latest version per student becomes published
    const latestPerStudent = await Marks.aggregate([
      { $match: { subjectCode, assessmentType } },
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
    res.json({ message: 'Marks published', count: latestIds.length });
  } catch (err) {
    next(err);
  }
};

// Student: view own marks (only published latest version)
exports.getMyMarks = async (req, res, next) => {
  try {
    const records = await Marks.aggregate([
      { $match: { studentId: req.user.id, published: true } },
      { $sort: { version: -1 } },
      {
        $group: {
          _id: { subjectCode: '$subjectCode', assessmentType: '$assessmentType' },
          doc: { $first: '$$ROOT' }
        }
      }
    ]);
    res.json(records.map((r) => r.doc));
  } catch (err) {
    next(err);
  }
};

