/**
 * Thin wrapper around the Socket.IO server so HTTP handlers can broadcast
 * board events without depending on the socket layer directly.
 * When no socket server is attached (e.g. in HTTP tests) emits are no-ops.
 */
let io = null;

export function attachIo(server) {
  io = server;
}

export function boardRoom(boardId) {
  return `board:${boardId}`;
}

/**
 * @param {string} boardId
 * @param {string} event
 * @param {unknown} payload
 * @param {{ exceptSocketId?: string }} [options] Skip the socket that originated the change
 *   (it already applied the change optimistically).
 */
export function emitToBoard(boardId, event, payload, { exceptSocketId } = {}) {
  if (!io) return;
  let target = io.to(boardRoom(boardId));
  if (exceptSocketId) target = target.except(exceptSocketId);
  target.emit(event, payload);
}

/** Reads the socket id sent by the client so it can be excluded from the broadcast. */
export function originSocket(req) {
  const id = req.get('x-socket-id');
  return id && id.length <= 64 ? { exceptSocketId: id } : {};
}

/**
 * Runs `fn` only after the transaction commits (or immediately when not in a
 * transaction), so clients never receive events for rolled back changes.
 */
export function afterCommit(trx, fn) {
  if (trx?.isTransaction && trx.executionPromise) {
    trx.executionPromise.then(fn).catch(() => {});
  } else {
    fn();
  }
}
