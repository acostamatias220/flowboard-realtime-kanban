export class AppError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} message Human readable message (safe to expose)
   * @param {string} [code] Machine readable error code
   * @param {unknown} [details] Optional extra details (e.g. validation issues)
   */
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, message, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict') {
    return new AppError(409, message, 'CONFLICT');
  }
}
