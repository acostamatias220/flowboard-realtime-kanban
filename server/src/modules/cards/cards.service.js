import { db } from '../../db/knex.js';
import { AppError } from '../../utils/AppError.js';
import { assertCardAccess, assertColumnAccess } from '../../services/access.js';
import { logActivity } from '../../services/activity.js';
import { lockBoard } from '../../services/locks.js';
import { afterCommit, emitToBoard } from '../../realtime/emitter.js';
import { POSITION_STEP, placeItem } from '../../utils/ordering.js';
import { toCard } from '../boards/boards.service.js';

async function labelIdsFor(trx, cardId) {
  const rows = await trx('card_labels').where({ card_id: cardId }).select('label_id');
  return rows.map((r) => r.label_id);
}

async function loadCard(trx, cardId) {
  const row = await trx('cards as c')
    .where('c.id', cardId)
    .first(
      'c.*',
      trx.raw('(select count(*) from comments cm where cm.card_id = c.id) as comment_count'),
    );
  return toCard(row, await labelIdsFor(trx, cardId));
}

export function toComment(row) {
  return {
    id: row.id,
    cardId: row.card_id,
    body: row.body,
    createdAt: row.created_at,
    author: { id: row.author_id, name: row.author_name, avatarColor: row.author_color },
  };
}

export async function create(columnId, userId, { title, description }, socketOpts) {
  const { column } = await assertColumnAccess(columnId, userId);
  return db.transaction(async (trx) => {
    await lockBoard(trx, column.board_id);
    const last = await trx('cards').where({ column_id: columnId }).max('position as max').first();
    const [row] = await trx('cards')
      .insert({
        board_id: column.board_id,
        column_id: columnId,
        title,
        description: description ?? null,
        position: (last?.max ?? 0) + POSITION_STEP,
        created_by: userId,
      })
      .returning('*');
    const card = toCard(row);
    await logActivity(trx, {
      boardId: column.board_id,
      userId,
      action: 'card.created',
      entityId: card.id,
      meta: { title, column: column.title },
    });
    afterCommit(trx, () => emitToBoard(column.board_id, 'card:created', card, socketOpts));
    return card;
  });
}

export async function getDetail(cardId, userId) {
  await assertCardAccess(cardId, userId);
  const card = await loadCard(db, cardId);
  const comments = await db('comments as cm')
    .join('users as u', 'u.id', 'cm.author_id')
    .where('cm.card_id', cardId)
    .orderBy('cm.created_at', 'asc')
    .select('cm.*', 'u.name as author_name', 'u.avatar_color as author_color');
  return { ...card, comments: comments.map(toComment) };
}

export async function update(cardId, userId, changes, socketOpts) {
  const { card: current, board } = await assertCardAccess(cardId, userId);

  if (changes.assigneeId) {
    const member = await db('workspace_members')
      .where({ workspace_id: board.workspace_id, user_id: changes.assigneeId })
      .first();
    if (!member) throw AppError.badRequest('Assignee must be a member of the workspace');
  }
  if (changes.labelIds?.length) {
    const found = await db('labels')
      .whereIn('id', changes.labelIds)
      .andWhere({ board_id: board.id })
      .count('* as n')
      .first();
    if (found.n !== new Set(changes.labelIds).size) {
      throw AppError.badRequest('Labels must belong to the same board');
    }
  }

  const patch = {};
  if (changes.title !== undefined) patch.title = changes.title;
  if (changes.description !== undefined) patch.description = changes.description;
  if (changes.assigneeId !== undefined) patch.assignee_id = changes.assigneeId;
  if (changes.dueDate !== undefined) patch.due_date = changes.dueDate;

  return db.transaction(async (trx) => {
    await trx('cards')
      .where({ id: cardId })
      .update({ ...patch, updated_at: trx.fn.now() });

    if (changes.labelIds !== undefined) {
      await trx('card_labels').where({ card_id: cardId }).delete();
      const unique = [...new Set(changes.labelIds)];
      if (unique.length) {
        await trx('card_labels').insert(
          unique.map((labelId) => ({ card_id: cardId, label_id: labelId })),
        );
      }
    }

    const card = await loadCard(trx, cardId);
    await logActivity(trx, {
      boardId: board.id,
      userId,
      action: 'card.updated',
      entityId: cardId,
      meta: { title: card.title, fields: Object.keys(changes), previousTitle: current.title },
    });
    afterCommit(trx, () => emitToBoard(board.id, 'card:updated', card, socketOpts));
    return card;
  });
}

export async function move(cardId, userId, { columnId, index }, socketOpts) {
  const { card: current, board } = await assertCardAccess(cardId, userId);
  const target = await db('columns').where({ id: columnId }).first();
  if (!target || target.board_id !== board.id) {
    throw AppError.badRequest('Target column must belong to the same board');
  }

  return db.transaction(async (trx) => {
    await lockBoard(trx, board.id);
    const { position, rebalanced } = await placeItem(
      trx,
      'cards',
      { column_id: columnId },
      cardId,
      index,
    );
    await trx('cards')
      .where({ id: cardId })
      .update({ column_id: columnId, position, updated_at: trx.fn.now() });

    const payload = {
      cardId,
      fromColumnId: current.column_id,
      toColumnId: columnId,
      position,
      rebalanced,
    };

    if (current.column_id !== columnId) {
      const from = await trx('columns').where({ id: current.column_id }).first('title');
      await logActivity(trx, {
        boardId: board.id,
        userId,
        action: 'card.moved',
        entityId: cardId,
        meta: { title: current.title, from: from?.title, to: target.title },
      });
    }
    afterCommit(trx, () => emitToBoard(board.id, 'card:moved', payload, socketOpts));
    return payload;
  });
}

export async function remove(cardId, userId, socketOpts) {
  const { card, board } = await assertCardAccess(cardId, userId);
  await db.transaction(async (trx) => {
    await trx('cards').where({ id: cardId }).delete();
    await logActivity(trx, {
      boardId: board.id,
      userId,
      action: 'card.deleted',
      entityId: cardId,
      meta: { title: card.title },
    });
    afterCommit(trx, () => emitToBoard(board.id, 'card:deleted', { id: cardId }, socketOpts));
  });
}

export async function addComment(cardId, userId, { body }, socketOpts) {
  const { card, board } = await assertCardAccess(cardId, userId);
  return db.transaction(async (trx) => {
    const [row] = await trx('comments')
      .insert({ card_id: cardId, author_id: userId, body })
      .returning('*');
    const author = await trx('users').where({ id: userId }).first('name', 'avatar_color');
    const comment = toComment({
      ...row,
      author_name: author.name,
      author_color: author.avatar_color,
    });
    await logActivity(trx, {
      boardId: board.id,
      userId,
      action: 'comment.added',
      entityId: cardId,
      meta: { title: card.title },
    });
    afterCommit(trx, () => emitToBoard(board.id, 'comment:created', comment, socketOpts));
    return comment;
  });
}

export async function deleteComment(commentId, userId, socketOpts) {
  const comment = await db('comments').where({ id: commentId }).first();
  if (!comment) throw AppError.notFound('Comment not found');
  const { board, role } = await assertCardAccess(comment.card_id, userId);
  if (comment.author_id !== userId && role === 'member') {
    throw AppError.forbidden('Only the author or an admin can delete this comment');
  }
  await db('comments').where({ id: commentId }).delete();
  emitToBoard(board.id, 'comment:deleted', { id: commentId, cardId: comment.card_id }, socketOpts);
}
