/**
 * In-memory presence registry: boardId -> userId -> { user, sockets }.
 * A user with several tabs open on the same board counts once and only
 * disappears when the last socket leaves.
 *
 * Note: this lives in the process memory, so with several API instances it
 * should move to Redis (e.g. together with @socket.io/redis-adapter).
 */
export class PresenceStore {
  constructor() {
    this.boards = new Map();
  }

  join(boardId, user, socketId) {
    if (!this.boards.has(boardId)) this.boards.set(boardId, new Map());
    const users = this.boards.get(boardId);
    if (!users.has(user.id)) users.set(user.id, { user, sockets: new Set() });
    users.get(user.id).sockets.add(socketId);
  }

  leave(boardId, userId, socketId) {
    const users = this.boards.get(boardId);
    const entry = users?.get(userId);
    if (!entry) return;
    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) users.delete(userId);
    if (users.size === 0) this.boards.delete(boardId);
  }

  list(boardId) {
    return [...(this.boards.get(boardId)?.values() ?? [])].map((e) => e.user);
  }
}
