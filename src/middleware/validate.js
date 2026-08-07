/**
 * Zod validation middleware — the gate every request body/params/query passes
 * before reaching a controller.
 *
 * Why server-side validation when the client also validates: the client can
 * be bypassed entirely (curl, Postman, a compromised browser). The server is
 * the real boundary; client-side Zod is only for instant UX feedback.
 *
 * Bonus: schemas with .trim()/.toLowerCase() transforms mean controllers
 * receive CLEAN data — validation and sanitization in one declarative place.
 *
 * Usage: router.post('/', validate({ body: loginSchema }), controller)
 */
import ApiError from '../utils/ApiError.js';

export const validate = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      // Field-level details let the frontend highlight the exact inputs.
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message,
      }));
      throw new ApiError(400, 'Validation failed.', details);
    }
    // Replace with the parsed output: unknown keys stripped, transforms applied.
    req[part] = result.data;
  }
  next();
};
