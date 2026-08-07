/**
 * asyncHandler — routes rejected promises into Express's error pipeline.
 *
 * Express 4 does NOT catch errors thrown inside async route handlers; an
 * unhandled rejection would hang the request. The naive fix is a try/catch
 * in every controller — pure duplication. Instead every controller is
 * wrapped once:
 *
 *   router.get('/', asyncHandler(listEmployees));
 *
 * Any throw (including ApiError from a service) lands in the centralized
 * error handler via next(err).
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
