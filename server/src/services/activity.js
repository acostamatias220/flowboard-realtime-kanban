import { db } from '../db/knex.js';
import { afterCommit, emitToBoard } from '../realtime/emitter.js';

export function toActivity(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    action: row.action,
    entityId: row.entity_id,
    meta: row.meta,
    createdAt: row.created_at,
    user: row.user_id ? { id: row.user_id, name: row.user_name } : null,
  };
}

/**
 * Persists an activity entry and pushes it to everyone on the board.
 * Accepts a transaction so the log is atomic with the change it describes.
 */
export async function logActivity(trx, { boardId, userId, action, entityId = null, meta = {} }) {
  const [row] = await trx('activities')
    .insert({ board_id: boardId, user_id: userId, action, entity_id: entityId, meta })
    .returning('*');
  const user = userId ? await trx('users').where({ id: userId }).first('name') : null;
  const activity = toActivity({ ...row, user_name: user?.name });
  afterCommit(trx, () => emitToBoard(boardId, 'activity:created', activity));
  return activity;
}

export async function listActivity(boardId, { limit = 30, before } = {}) {
  const rows = await db('activities as a')
    .leftJoin('users as u', 'u.id', 'a.user_id')
    .where('a.board_id', boardId)
    .modify((q) => {
      if (before) q.where('a.id', '<', before);
    })
    .orderBy('a.id', 'desc')
    .limit(limit)
    .select('a.*', 'u.name as user_name');
  return rows.map(toActivity);
}
