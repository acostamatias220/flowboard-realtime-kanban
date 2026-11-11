import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const skip = () => env.NODE_ENV === 'test';

/** General API limiter. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
});

/** Stricter limiter for credential endpoints to slow down brute force attacks. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' } },
});
