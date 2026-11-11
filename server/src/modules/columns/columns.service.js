import { db } from '../../db/knex.js';
import { assertBoardAccess, assertColumnAccess } from '../../services/access.js';
import { logActivity } from '../../services/activity.js';
import { lockBoard } from '../../services/locks.js';
import { afterCommit, emitToBoard } from '../../realtime/emitter.js';
import { POSITION_STEP, placeItem } from '../../utils/ordering.js';
import { toColumn } from '../boards/boards.service.js';

export async function create(boardId, userId, { title, wipLimit }, socketOpts) {
  await assertBoardAccess(boardId, userId);
  return db.transaction(async (trx) => {
    await lockBoard(trx, boardId);
    const last = await trx('columns').where({ board_id: boardId }).max('position as max').first();
    const [row] = await trx('columns')
      .insert({
        board_id: boardId,
        title,
        wip_limit: wipLimit ?? null,
        position: (last?.max ?? 0) + POSITION_STEP,
      })
      .returning('*');
    const column = toColumn(row);
    await logActivity(trx, {
      boardId,
      userId,
      action: 'column.created',
      entityId: column.id,
      meta: { title },
    });
    afterCommit(trx, () => emitToBoard(boardId, 'column:created', column, socketOpts));
    return column;
  });
}

export async function update(columnId, userId, changes, socketOpts) {
  const { column: current } = await assertColumnAccess(columnId, userId);
  const patch = { updated_at: db.fn.now() };
  if (changes.title !== undefined) patch.title = changes.title;
  if (changes.wipLimit !== undefined) patch.wip_limit = changes.wipLimit;

  return db.transaction(async (trx) => {
    const [row] = await trx('columns').where({ id: columnId }).update(patch).returning('*');
    const column = toColumn(row);
    if (changes.title !== undefined && changes.title !== current.title) {
      await logActivity(trx, {
        boardId: column.boardId,
        userId,
        action: 'column.renamed',
        entityId: columnId,
        meta: { from: current.title, to: changes.title },
      });
    }
    afterCommit(trx, () => emitToBoard(column.boardId, 'column:updated', column, socketOpts));
    return column;
  });
}

export async function move(columnId, userId, { index }, socketOpts) {
  const { column } = await assertColumnAccess(columnId, userId);
  return db.transaction(async (trx) => {
    await lockBoard(trx, column.board_id);
    const { position, rebalanced } = await placeItem(
      trx,
      'columns',
      { board_id: column.board_id },
      columnId,
      index,
    );
    const [row] = await trx('columns')
      .where({ id: columnId })
      .update({ position, updated_at: trx.fn.now() })
      .returning('*');
    const payload = { column: toColumn(row), rebalanced };
    afterCommit(trx, () => emitToBoard(column.board_id, 'column:moved', payload, socketOpts));
    return payload;
  });
}

export async function remove(columnId, userId, socketOpts) {
  const { column } = await assertColumnAccess(columnId, userId, 'admin');
  await db.transaction(async (trx) => {
    await trx('columns').where({ id: columnId }).delete();
    await logActivity(trx, {
      boardId: column.board_id,
      userId,
      action: 'column.deleted',
      entityId: columnId,
      meta: { title: column.title },
    });
    afterCommit(trx, () =>
      emitToBoard(column.board_id, 'column:deleted', { id: columnId }, socketOpts),
    );
  });
}
