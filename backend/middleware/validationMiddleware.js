const validationMiddleware = (validators = []) => {
  return async (req, res, next) => {
    try {
      for (const validator of validators) {
        // Each validator is expected to throw an Error with message on failure
        // or return normally on success.
        // It can be async or sync.
        // Signature: validator(req)
        // eslint-disable-next-line no-await-in-loop
        await validator(req);
      }
      next();
    } catch (err) {
      return res.status(400).json({ message: err.message || 'Validation failed' });
    }
  };
};

module.exports = validationMiddleware;

