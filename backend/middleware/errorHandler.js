// Basic error-handling middleware for Express
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Server Error';
  res.status(statusCode).json({ message });
};

module.exports = errorHandler;

