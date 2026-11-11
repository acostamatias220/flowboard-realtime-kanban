import http from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createSocketServer } from '../src/realtime/socket.js';
import { api, app, auth, createBoard, createUser, db, resetDb } from './helpers.js';

let server;
let io;
let url;
const clients = [];

function connect(user) {
  const socket = ioClient(url, {
    auth: { token: user?.token },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  clients.push(socket);
  return socket;
}

const once = (socket, event, timeout = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const join = (socket, boardId) =>
  new Promise((resolve) => socket.emit('board:join', boardId, resolve));

beforeAll(async () => {
  server = http.createServer(app);
  io = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterEach(() => {
  while (clients.length) clients.pop().disconnect();
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => server.close(resolve));
  await db.destroy();
});

describe('realtime', () => {
  beforeEach(resetDb);

  it('rejects connections without a valid access token', async () => {
    const socket = connect({ token: 'invalid' });
    const err = await once(socket, 'connect_error');
    expect(err.message).toBe('UNAUTHORIZED');
  });

  it('does not let non members join a board room', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const { board } = await createBoard(owner);
    const socket = connect(stranger);
    await once(socket, 'connect');
    expect(await join(socket, board.id)).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('tracks presence of users on a board', async () => {
    const owner = await createUser({ name: 'Ana' });
    const member = await createUser({ name: 'Bruno' });
    await api()
      .post(`/api/workspaces/${owner.workspaceId}/members`)
      .set(auth(owner))
      .send({ email: member.email })
      .expect(201);
    const { board } = await createBoard(owner);

    const a = connect(owner);
    await once(a, 'connect');
    expect((await join(a, board.id)).users.map((u) => u.name)).toEqual(['Ana']);

    const presence = once(a, 'presence:update');
    const b = connect(member);
    await once(b, 'connect');
    await join(b, board.id);
    expect((await presence).users.map((u) => u.name).sort()).toEqual(['Ana', 'Bruno']);

    const left = once(a, 'presence:update');
    b.disconnect();
    expect((await left).users.map((u) => u.name)).toEqual(['Ana']);
  });

  it('broadcasts card moves to other users but not to the originating socket', async () => {
    const owner = await createUser();
    const { board, columns } = await createBoard(owner);
    const card = (
      await api()
        .post(`/api/columns/${columns[0].id}/cards`)
        .set(auth(owner))
        .send({ title: 'Realtime' })
        .expect(201)
    ).body.card;

    const origin = connect(owner);
    const watcher = connect(owner); // same user, second tab
    await Promise.all([once(origin, 'connect'), once(watcher, 'connect')]);
    await join(origin, board.id);
    await join(watcher, board.id);

    let originReceived = false;
    origin.on('card:moved', () => {
      originReceived = true;
    });
    const received = once(watcher, 'card:moved');

    await api()
      .patch(`/api/cards/${card.id}/move`)
      .set(auth(owner))
      .set('X-Socket-Id', origin.id)
      .send({ columnId: columns[1].id, index: 0 })
      .expect(200);

    expect(await received).toMatchObject({
      cardId: card.id,
      fromColumnId: columns[0].id,
      toColumnId: columns[1].id,
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(originReceived).toBe(false);
  });

  it('pushes activity entries after the change is committed', async () => {
    const owner = await createUser();
    const { board, columns } = await createBoard(owner);
    const socket = connect(owner);
    await once(socket, 'connect');
    await join(socket, board.id);

    const activity = once(socket, 'activity:created');
    await api()
      .post(`/api/columns/${columns[0].id}/cards`)
      .set(auth(owner))
      .send({ title: 'Hello' })
      .expect(201);
    expect(await activity).toMatchObject({ action: 'card.created', meta: { title: 'Hello' } });
  });
});
