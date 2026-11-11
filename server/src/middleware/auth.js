import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';

/** Requires a valid `Authorization: Bearer <accessToken>` header. */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized());
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token';
    next(new AppError(401, message, 'INVALID_TOKEN'));
  }
}
