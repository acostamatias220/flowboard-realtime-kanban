import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { REFRESH_COOKIE, refreshCookieOptions } from '../../utils/tokens.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

function sendSession(res, status, { user, accessToken, refreshToken }) {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(status).json({ user, accessToken });
}

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  sendSession(res, 201, await authService.register(req.valid.body));
});

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  sendSession(res, 200, await authService.login(req.valid.body));
});

authRouter.post('/refresh', async (req, res) => {
  try {
    sendSession(res, 200, await authService.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (err) {
    const { maxAge: _maxAge, ...clearOptions } = refreshCookieOptions();
    res.clearCookie(REFRESH_COOKIE, clearOptions);
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  const { maxAge: _maxAge, ...clearOptions } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await authService.getUser(req.user.id) });
});
