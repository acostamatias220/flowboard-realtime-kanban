/**
 * Takes a row level lock on the board. Every ordering operation of a board
 * (moving cards or columns) goes through this lock, so two users dragging at
 * the same time are applied one after the other instead of computing
 * positions from stale data.
 */
export function lockBoard(trx, boardId) {
  return trx('boards').where({ id: boardId }).forUpdate().first('id');
}
