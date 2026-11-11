import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, createBoard, createUser, db, resetDb } from './helpers.js';

async function addMember(owner, member, role = 'member') {
  return api()
    .post(`/api/workspaces/${owner.workspaceId}/members`)
    .set(auth(owner))
    .send({ email: member.email, role })
    .expect(201);
}

async function createCard(user, columnId, title) {
  const res = await api()
    .post(`/api/columns/${columnId}/cards`)
    .set(auth(user))
    .send({ title })
    .expect(201);
  return res.body.card;
}

async function cardTitlesByColumn(user, boardId) {
  const res = await api().get(`/api/boards/${boardId}`).set(auth(user)).expect(200);
  return Object.fromEntries(
    res.body.columns.map((col) => [
      col.title,
      res.body.cards
        .filter((c) => c.columnId === col.id)
        .sort((a, b) => a.position - b.position)
        .map((c) => c.title),
    ]),
  );
}

afterAll(() => db.destroy());

describe('workspaces & boards', () => {
  beforeEach(resetDb);

  it('creates a board with default columns', async () => {
    const owner = await createUser();
    const { board, columns, role } = await createBoard(owner, 'Roadmap');
    expect(board.title).toBe('Roadmap');
    expect(role).toBe('owner');
    expect(columns.map((c) => c.title)).toEqual(['Por hacer', 'En progreso', 'Hecho']);
  });

  it('hides boards from users outside the workspace', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const { board } = await createBoard(owner);
    await api().get(`/api/boards/${board.id}`).set(auth(stranger)).expect(404);
    await api().get(`/api/workspaces/${owner.workspaceId}`).set(auth(stranger)).expect(404);
  });

  it('lets invited members access the board and enforces roles', async () => {
    const owner = await createUser();
    const member = await createUser();
    const admin = await createUser();
    const { board } = await createBoard(owner);

    await addMember(owner, member);
    await addMember(owner, admin, 'admin');

    const res = await api().get(`/api/boards/${board.id}`).set(auth(member)).expect(200);
    expect(res.body.role).toBe('member');
    expect(res.body.members).toHaveLength(3);

    // members cannot invite admins nor delete boards
    await api()
      .post(`/api/workspaces/${owner.workspaceId}/members`)
      .set(auth(member))
      .send({ email: 'x@test.dev' })
      .expect(403);
    await api().delete(`/api/boards/${board.id}`).set(auth(member)).expect(403);

    // admins can delete boards
    await api().delete(`/api/boards/${board.id}`).set(auth(admin)).expect(204);
    await api().get(`/api/boards/${board.id}`).set(auth(owner)).expect(404);
  });

  it('only the owner can change roles and the owner cannot be removed', async () => {
    const owner = await createUser();
    const admin = await createUser();
    await addMember(owner, admin, 'admin');

    await api()
      .patch(`/api/workspaces/${owner.workspaceId}/members/${owner.id}`)
      .set(auth(admin))
      .send({ role: 'member' })
      .expect(403);
    await api()
      .delete(`/api/workspaces/${owner.workspaceId}/members/${owner.id}`)
      .set(auth(admin))
      .expect(400);
    await api()
      .patch(`/api/workspaces/${owner.workspaceId}/members/${admin.id}`)
      .set(auth(owner))
      .send({ role: 'member' })
      .expect(200);
  });
});

describe('cards', () => {
  beforeEach(resetDb);

  it('creates, updates and validates cards', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const { board, columns } = await createBoard(owner);

    const card = await createCard(owner, columns[0].id, 'Write tests');
    const label = (
      await api()
        .post(`/api/boards/${board.id}/labels`)
        .set(auth(owner))
        .send({ name: 'Backend', color: '#0ea5e9' })
        .expect(201)
    ).body.label;

    const updated = await api()
      .patch(`/api/cards/${card.id}`)
      .set(auth(owner))
      .send({
        description: 'Cover the API',
        assigneeId: owner.id,
        dueDate: '2026-12-31',
        labelIds: [label.id],
      })
      .expect(200);
    expect(updated.body.card).toMatchObject({
      description: 'Cover the API',
      assigneeId: owner.id,
      dueDate: '2026-12-31',
      labelIds: [label.id],
    });

    // assignee must belong to the workspace
    await api()
      .patch(`/api/cards/${card.id}`)
      .set(auth(owner))
      .send({ assigneeId: stranger.id })
      .expect(400);
    // invalid date format
    await api()
      .patch(`/api/cards/${card.id}`)
      .set(auth(owner))
      .send({ dueDate: '31/12/2026' })
      .expect(400);
    // empty update
    await api().patch(`/api/cards/${card.id}`).set(auth(owner)).send({}).expect(400);
    // strangers cannot see the card
    await api().get(`/api/cards/${card.id}`).set(auth(stranger)).expect(404);
  });

  it('moves cards within and across columns and persists the order', async () => {
    const owner = await createUser();
    const { board, columns } = await createBoard(owner);
    const [todo, doing] = columns;

    const a = await createCard(owner, todo.id, 'A');
    await createCard(owner, todo.id, 'B');
    const c = await createCard(owner, todo.id, 'C');

    // C to the top of the same column
    await api()
      .patch(`/api/cards/${c.id}/move`)
      .set(auth(owner))
      .send({ columnId: todo.id, index: 0 })
      .expect(200);
    expect((await cardTitlesByColumn(owner, board.id))['Por hacer']).toEqual(['C', 'A', 'B']);

    // A to another column
    const moved = await api()
      .patch(`/api/cards/${a.id}/move`)
      .set(auth(owner))
      .send({ columnId: doing.id, index: 0 })
      .expect(200);
    expect(moved.body).toMatchObject({ fromColumnId: todo.id, toColumnId: doing.id });

    const titles = await cardTitlesByColumn(owner, board.id);
    expect(titles['Por hacer']).toEqual(['C', 'B']);
    expect(titles['En progreso']).toEqual(['A']);
  });

  it('rebalances positions when the gap between neighbours is exhausted', async () => {
    const owner = await createUser();
    const { board, columns } = await createBoard(owner);
    const first = await createCard(owner, columns[0].id, 'first');
    const second = await createCard(owner, columns[0].id, 'second');
    const third = await createCard(owner, columns[0].id, 'third');

    // Force two neighbours to be almost equal.
    await db('cards').where({ id: first.id }).update({ position: 1 });
    await db('cards')
      .where({ id: second.id })
      .update({ position: 1 + 1e-9 });

    const res = await api()
      .patch(`/api/cards/${third.id}/move`)
      .set(auth(owner))
      .send({ columnId: columns[0].id, index: 1 })
      .expect(200);

    expect(res.body.rebalanced).toEqual([
      { id: first.id, position: 1024 },
      { id: third.id, position: 2048 },
      { id: second.id, position: 3072 },
    ]);
    expect((await cardTitlesByColumn(owner, board.id))['Por hacer']).toEqual([
      'first',
      'third',
      'second',
    ]);
  });

  it('rejects moving a card to a column of another board', async () => {
    const owner = await createUser();
    const one = await createBoard(owner, 'One');
    const two = await createBoard(owner, 'Two');
    const card = await createCard(owner, one.columns[0].id, 'x');
    await api()
      .patch(`/api/cards/${card.id}/move`)
      .set(auth(owner))
      .send({ columnId: two.columns[0].id, index: 0 })
      .expect(400);
  });

  it('reorders columns', async () => {
    const owner = await createUser();
    const { board, columns } = await createBoard(owner);
    await api()
      .patch(`/api/columns/${columns[2].id}/move`)
      .set(auth(owner))
      .send({ index: 0 })
      .expect(200);
    const res = await api().get(`/api/boards/${board.id}`).set(auth(owner)).expect(200);
    expect(res.body.columns.map((c) => c.title)).toEqual(['Hecho', 'Por hacer', 'En progreso']);
  });

  it('adds comments and records the activity log', async () => {
    const owner = await createUser({ name: 'Ana' });
    const { board, columns } = await createBoard(owner);
    const card = await createCard(owner, columns[0].id, 'Deploy');

    await api()
      .post(`/api/cards/${card.id}/comments`)
      .set(auth(owner))
      .send({ body: 'Looks good' })
      .expect(201);
    await api()
      .patch(`/api/cards/${card.id}/move`)
      .set(auth(owner))
      .send({ columnId: columns[2].id, index: 0 })
      .expect(200);

    const detail = await api().get(`/api/cards/${card.id}`).set(auth(owner)).expect(200);
    expect(detail.body.card.comments).toEqual([
      expect.objectContaining({
        body: 'Looks good',
        author: expect.objectContaining({ name: 'Ana' }),
      }),
    ]);

    const activity = await api()
      .get(`/api/boards/${board.id}/activity`)
      .set(auth(owner))
      .expect(200);
    expect(activity.body.activities.map((a) => a.action)).toEqual([
      'card.moved',
      'comment.added',
      'card.created',
      'board.created',
    ]);
    expect(activity.body.activities[0].meta).toMatchObject({ from: 'Por hacer', to: 'Hecho' });
  });

  it('only admins can delete columns', async () => {
    const owner = await createUser();
    const member = await createUser();
    await addMember(owner, member);
    const { columns } = await createBoard(owner);
    await api().delete(`/api/columns/${columns[0].id}`).set(auth(member)).expect(403);
    await api().delete(`/api/columns/${columns[0].id}`).set(auth(owner)).expect(204);
  });
});

describe('errors', () => {
  it('returns 404 JSON for unknown routes and 400 for malformed ids', async () => {
    const user = await createUser();
    const res = await api().get('/api/nope').set(auth(user)).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    await api().get('/api/boards/not-a-uuid').set(auth(user)).expect(400);
  });

  it('sets security headers', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
