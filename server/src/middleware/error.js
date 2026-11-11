import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// Postgres error codes we translate into client errors.
const PG_ERRORS = {
  23505: () => AppError.conflict('Resource already exists'),
  23503: () => AppError.badRequest('Referenced resource does not exist'),
  '22P02': () => AppError.badRequest('Invalid identifier'),
};

export function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof AppError)) {
    if (error?.type === 'entity.parse.failed') {
      error = AppError.badRequest('Malformed JSON body');
    } else if (error?.code && PG_ERRORS[error.code]) {
      error = PG_ERRORS[error.code]();
    } else {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[unhandled]', err);
      }
      error = new AppError(500, 'Internal server error', 'INTERNAL');
    }
  }

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}
