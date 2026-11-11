import { AppError } from '../utils/AppError.js';

/**
 * Validates `req.body`, `req.params` and/or `req.query` against zod schemas.
 * Parsed (and coerced) values replace the originals in `req.valid`.
 *
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid ?? {};
    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key] ?? {});
      if (!result.success) {
        const issues = result.error.issues.map((i) => ({
          path: [key, ...i.path].join('.'),
          message: i.message,
        }));
        return next(AppError.badRequest('Validation failed', issues));
      }
      req.valid[key] = result.data;
    }
    next();
  };
}
