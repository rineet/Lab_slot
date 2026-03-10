const ExcelJS = require('exceljs');

function normalizeCellValue(value) {
  if (value === undefined || value === null) return null;

  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return String(value.text).trim();
    }
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return value.result;
    }
    return String(value).trim();
  }

  if (typeof value === 'string') return value.trim();
  return value;
}

async function parseFirstSheetBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers = [];

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(normalizeCellValue(cell.value) || '').trim();
  });

  const rows = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowObject = {};
    let hasData = false;

    headers.forEach((header, colNumber) => {
      if (!header) return;
      const value = normalizeCellValue(row.getCell(colNumber).value);
      rowObject[header] = value;
      if (value !== null && value !== '') {
        hasData = true;
      }
    });

    if (hasData) {
      rows.push(rowObject);
    }
  });

  return rows;
}

module.exports = { parseFirstSheetBuffer };
