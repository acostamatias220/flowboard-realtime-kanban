import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const REFRESH_COOKIE = 'kb_refresh';

/** Short lived, stateless access token (sent in the Authorization header). */
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'kanban-realtime',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'kanban-realtime' });
}

/** Long lived, opaque refresh token. Only its SHA-256 hash is persisted. */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}
