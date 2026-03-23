// Basic error-handling middleware for Express
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);
  const isUploadValidationError =
    err?.name === 'MulterError' ||
    err?.code === 'LIMIT_FILE_SIZE' ||
    /invalid file type/i.test(err?.message || '');
  const statusCode = err.statusCode || (isUploadValidationError ? 400 : 500);
  const message = err.message || 'Server Error';
  res.status(statusCode).json({ message });
};

module.exports = errorHandler;
