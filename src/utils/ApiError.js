/**
 * ApiError — the ONE way application code signals an HTTP failure.
 *
 * Services and middleware `throw new ApiError(status, message)` and the
 * centralized error handler turns it into the standard JSON envelope.
 * This keeps HTTP status knowledge out of ad-hoc `res.status(...)` calls
 * scattered through the codebase.
 *
 * `isOperational` distinguishes expected failures (bad input, not found,
 * forbidden — safe to show the client) from programmer bugs (undefined is
 * not a function — must be hidden behind a generic 500).
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status (400, 401, 403, 404, 409, 500...)
   * @param {string} message    Safe-for-client, human-readable explanation
   * @param {Array}  [details]  Optional structured details (e.g. field-level
   *                            validation errors) for the client to render
   */
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true; // thrown deliberately, safe to expose message
    // Keeps this constructor call out of the stack trace so logs point at
    // the line that actually threw.
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
