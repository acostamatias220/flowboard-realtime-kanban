import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/knex.js';

export const app = createApp();
export const api = () => request(app);

export async function resetDb() {
  await db.raw(
    'TRUNCATE activities, comments, card_labels, labels, cards, columns, boards, workspace_members, workspaces, refresh_tokens, users RESTART IDENTITY CASCADE',
  );
}

let counter = 0;

/** Registers a fresh user and returns its access token, cookie and personal workspace. */
export async function createUser(overrides = {}) {
  counter += 1;
  const body = {
    name: overrides.name ?? `User ${counter}`,
    email: overrides.email ?? `user${counter}-${Date.now()}@test.dev`,
    password: overrides.password ?? 'Sup3rSafePass',
  };
  const res = await api().post('/api/auth/register').send(body).expect(201);
  const workspaces = await api()
    .get('/api/workspaces')
    .set('Authorization', `Bearer ${res.body.accessToken}`)
    .expect(200);
  return {
    ...res.body.user,
    password: body.password,
    token: res.body.accessToken,
    cookie: res.headers['set-cookie'],
    workspaceId: workspaces.body.workspaces[0].id,
  };
}

export const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

/** Creates a board (with default columns) in the user's personal workspace. */
export async function createBoard(user, title = 'Test board') {
  const created = await api()
    .post(`/api/workspaces/${user.workspaceId}/boards`)
    .set(auth(user))
    .send({ title })
    .expect(201);
  const full = await api().get(`/api/boards/${created.body.board.id}`).set(auth(user)).expect(200);
  return full.body;
}

export { db };
