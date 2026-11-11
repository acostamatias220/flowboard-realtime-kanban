import { db } from '../../db/knex.js';
import { assertBoardAccess, assertWorkspaceRole } from '../../services/access.js';
import { logActivity } from '../../services/activity.js';
import { afterCommit, emitToBoard } from '../../realtime/emitter.js';
import { evenlySpaced } from '../../utils/ordering.js';
import { getMembers } from '../workspaces/workspaces.service.js';
import { AppError } from '../../utils/AppError.js';

const DEFAULT_COLUMNS = ['Por hacer', 'En progreso', 'Hecho'];

export function toBoard(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toColumn(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    position: row.position,
    wipLimit: row.wip_limit,
  };
}

export function toCard(row, labelIds = []) {
  return {
    id: row.id,
    boardId: row.board_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    position: row.position,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    labelIds,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const toLabel = (row) => ({ id: row.id, name: row.name, color: row.color });

export async function create(
  workspaceId,
  userId,
  { title, description, color, withDefaultColumns },
) {
  await assertWorkspaceRole(workspaceId, userId);
  return db.transaction(async (trx) => {
    const [board] = await trx('boards')
      .insert({ workspace_id: workspaceId, title, description, color, created_by: userId })
      .returning('*');
    if (withDefaultColumns) {
      const positions = evenlySpaced(DEFAULT_COLUMNS.length);
      await trx('columns').insert(
        DEFAULT_COLUMNS.map((t, i) => ({ board_id: board.id, title: t, position: positions[i] })),
      );
    }
    await logActivity(trx, {
      boardId: board.id,
      userId,
      action: 'board.created',
      entityId: board.id,
      meta: { title },
    });
    return toBoard(board);
  });
}

/** Full board snapshot used by the board page (columns + cards + labels + members). */
export async function getFull(boardId, userId) {
  const { board, role } = await assertBoardAccess(boardId, userId);

  const [columns, cards, cardLabels, labels, members, workspace] = await Promise.all([
    db('columns').where({ board_id: boardId }).orderBy('position'),
    db('cards as c')
      .where('c.board_id', boardId)
      .orderBy('c.position')
      .select(
        'c.*',
        db.raw('(select count(*) from comments cm where cm.card_id = c.id) as comment_count'),
      ),
    db('card_labels as cl')
      .join('cards as c', 'c.id', 'cl.card_id')
      .where('c.board_id', boardId)
      .select('cl.card_id', 'cl.label_id'),
    db('labels').where({ board_id: boardId }).orderBy('name'),
    getMembers(board.workspace_id),
    db('workspaces').where({ id: board.workspace_id }).first('id', 'name'),
  ]);

  const labelsByCard = new Map();
  for (const { card_id: cardId, label_id: labelId } of cardLabels) {
    if (!labelsByCard.has(cardId)) labelsByCard.set(cardId, []);
    labelsByCard.get(cardId).push(labelId);
  }

  return {
    board: toBoard(board),
    workspace,
    role,
    members,
    labels: labels.map(toLabel),
    columns: columns.map(toColumn),
    cards: cards.map((c) => toCard(c, labelsByCard.get(c.id) ?? [])),
  };
}

export async function update(boardId, userId, changes, socketOpts) {
  await assertBoardAccess(boardId, userId);
  const patch = { updated_at: db.fn.now() };
  if (changes.title !== undefined) patch.title = changes.title;
  if (changes.description !== undefined) patch.description = changes.description;
  if (changes.color !== undefined) patch.color = changes.color;

  return db.transaction(async (trx) => {
    const [row] = await trx('boards').where({ id: boardId }).update(patch).returning('*');
    const board = toBoard(row);
    await logActivity(trx, {
      boardId,
      userId,
      action: 'board.updated',
      entityId: boardId,
      meta: { fields: Object.keys(changes) },
    });
    afterCommit(trx, () => emitToBoard(boardId, 'board:updated', board, socketOpts));
    return board;
  });
}

export async function remove(boardId, userId) {
  await assertBoardAccess(boardId, userId, 'admin');
  await db('boards').where({ id: boardId }).delete();
  emitToBoard(boardId, 'board:deleted', { boardId });
}

export async function createLabel(boardId, userId, { name, color }, socketOpts) {
  await assertBoardAccess(boardId, userId);
  const [row] = await db('labels').insert({ board_id: boardId, name, color }).returning('*');
  const label = toLabel(row);
  emitToBoard(boardId, 'label:created', label, socketOpts);
  return label;
}

export async function deleteLabel(labelId, userId, socketOpts) {
  const label = await db('labels').where({ id: labelId }).first();
  if (!label) throw AppError.notFound('Label not found');
  await assertBoardAccess(label.board_id, userId);
  await db('labels').where({ id: labelId }).delete();
  emitToBoard(label.board_id, 'label:deleted', { id: labelId }, socketOpts);
}
