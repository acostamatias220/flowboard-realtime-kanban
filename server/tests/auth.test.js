import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, createUser, db, resetDb } from './helpers.js';

const getCookie = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('kb_refresh='));

describe('auth', () => {
  beforeEach(resetDb);
  afterAll(() => db.destroy());

  it('registers a user, hashes the password and sets an httpOnly refresh cookie', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ANA@Example.com', password: 'Password123' })
      .expect(201);

    expect(res.body.user).toMatchObject({ name: 'Ana', email: 'ana@example.com' });
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.accessToken).toEqual(expect.any(String));

    const cookie = getCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);

    const row = await db('users').where({ email: 'ana@example.com' }).first();
    expect(row.password_hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('creates a personal workspace on registration', async () => {
    const user = await createUser({ name: 'Bruno Díaz' });
    const res = await api()
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(res.body.workspaces).toEqual([
      expect.objectContaining({ name: "Bruno's workspace", role: 'owner' }),
    ]);
  });

  it('rejects invalid payloads with validation details', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['body.name', 'body.email', 'body.password']));
  });

  it('rejects duplicated emails', async () => {
    const user = await createUser();
    await api()
      .post('/api/auth/register')
      .send({ name: 'Other', email: user.email, password: 'Password123' })
      .expect(409);
  });

  it('logs in with valid credentials and rejects wrong ones with a generic message', async () => {
    const user = await createUser();
    await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    const wrong = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'WrongPass123' })
      .expect(401);
    const unknown = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@test.dev', password: 'WrongPass123' })
      .expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('protects routes with the access token', async () => {
    const user = await createUser();
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
    const res = await api()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const user = await createUser();
    const first = user.cookie.find((c) => c.startsWith('kb_refresh='));

    const refreshed = await api().post('/api/auth/refresh').set('Cookie', first).expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    const second = getCookie(refreshed);
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    // Reusing the first (already rotated) token is treated as theft.
    const reuse = await api().post('/api/auth/refresh').set('Cookie', first).expect(401);
    expect(reuse.body.error.message).toMatch(/reuse/i);

    // ...and the whole family is revoked, so the latest token stops working too.
    await api().post('/api/auth/refresh').set('Cookie', second).expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const user = await createUser();
    const cookie = user.cookie.find((c) => c.startsWith('kb_refresh='));
    await api().post('/api/auth/logout').set('Cookie', cookie).expect(204);
    await api().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('stores only hashes of refresh tokens', async () => {
    const user = await createUser();
    const raw = user.cookie
      .find((c) => c.startsWith('kb_refresh='))
      .split(';')[0]
      .split('=')[1];
    const rows = await db('refresh_tokens').select('token_hash');
    expect(rows.some((r) => r.token_hash === raw)).toBe(false);
    expect(rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
