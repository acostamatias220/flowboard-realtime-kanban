import { db } from '../db/knex.js';
import { AppError } from '../utils/AppError.js';

const ROLE_RANK = { member: 1, admin: 2, owner: 3 };

export function hasRole(role, minRole) {
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK[minRole];
}

/**
 * Returns the caller's role in a workspace. Non members get a 404 instead of a
 * 403 so the API does not reveal which resources exist.
 */
export async function assertWorkspaceRole(workspaceId, userId, minRole = 'member', trx = db) {
  const membership = await trx('workspace_members')
    .where({ workspace_id: workspaceId, user_id: userId })
    .first('role');
  if (!membership) throw AppError.notFound('Workspace not found');
  if (!hasRole(membership.role, minRole)) throw AppError.forbidden();
  return membership.role;
}

export async function assertBoardAccess(boardId, userId, minRole = 'member', trx = db) {
  const board = await trx('boards').where({ id: boardId }).first();
  if (!board) throw AppError.notFound('Board not found');
  try {
    const role = await assertWorkspaceRole(board.workspace_id, userId, minRole, trx);
    return { board, role };
  } catch (err) {
    if (err.status === 404) throw AppError.notFound('Board not found');
    throw err;
  }
}

export async function assertColumnAccess(columnId, userId, minRole = 'member', trx = db) {
  const column = await trx('columns').where({ id: columnId }).first();
  if (!column) throw AppError.notFound('Column not found');
  const { board, role } = await assertBoardAccess(column.board_id, userId, minRole, trx);
  return { column, board, role };
}

export async function assertCardAccess(cardId, userId, minRole = 'member', trx = db) {
  const card = await trx('cards').where({ id: cardId }).first();
  if (!card) throw AppError.notFound('Card not found');
  const { board, role } = await assertBoardAccess(card.board_id, userId, minRole, trx);
  return { card, board, role };
}
