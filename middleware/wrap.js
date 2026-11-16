// Sends errors from async route handlers to the error handler instead of crashing the server
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
