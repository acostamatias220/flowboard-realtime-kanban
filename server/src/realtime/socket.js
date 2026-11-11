import { Server } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/knex.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { assertBoardAccess } from '../services/access.js';
import { attachIo, boardRoom } from './emitter.js';
import { PresenceStore } from './presence.js';

const boardIdSchema = z.string().uuid();

/**
 * Socket.IO is used only to push changes to clients. All mutations go through
 * the REST API (single source of truth, validation and authorization in one
 * place); after a successful commit the API broadcasts an event to the
 * `board:<id>` room.
 */
export function createSocketServer(httpServer, { presence = new PresenceStore() } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  // Authenticate the handshake with the same short lived access token as the API.
  io.use(async (socket, next) => {
    try {
      const payload = verifyAccessToken(socket.handshake.auth?.token);
      const user = await db('users').where({ id: payload.sub }).first('id', 'name', 'avatar_color');
      if (!user) return next(new Error('UNAUTHORIZED'));
      socket.data.user = { id: user.id, name: user.name, avatarColor: user.avatar_color };
      socket.data.boards = new Set();
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  const broadcastPresence = (boardId) => {
    io.to(boardRoom(boardId)).emit('presence:update', {
      boardId,
      users: presence.list(boardId),
    });
  };

  const leaveBoard = (socket, boardId) => {
    socket.leave(boardRoom(boardId));
    socket.data.boards.delete(boardId);
    presence.leave(boardId, socket.data.user.id, socket.id);
    broadcastPresence(boardId);
  };

  io.on('connection', (socket) => {
    socket.on('board:join', async (boardId, ack = () => {}) => {
      if (!boardIdSchema.safeParse(boardId).success) return ack({ ok: false, error: 'INVALID_ID' });
      try {
        await assertBoardAccess(boardId, socket.data.user.id);
      } catch {
        return ack({ ok: false, error: 'FORBIDDEN' });
      }
      await socket.join(boardRoom(boardId));
      socket.data.boards.add(boardId);
      presence.join(boardId, socket.data.user, socket.id);
      broadcastPresence(boardId);
      ack({ ok: true, users: presence.list(boardId) });
    });

    socket.on('board:leave', (boardId) => {
      if (socket.data.boards.has(boardId)) leaveBoard(socket, boardId);
    });

    // Lightweight "who is looking at which card" indicator. Never persisted.
    socket.on('card:focus', ({ boardId, cardId } = {}) => {
      if (!socket.data.boards.has(boardId)) return;
      socket.to(boardRoom(boardId)).emit('card:focus', {
        userId: socket.data.user.id,
        cardId: cardId ?? null,
      });
    });

    socket.on('disconnect', () => {
      for (const boardId of [...socket.data.boards]) leaveBoard(socket, boardId);
    });
  });

  attachIo(io);
  return io;
}
