import { db } from '../../db/knex.js';
import { AppError } from '../../utils/AppError.js';
import { assertWorkspaceRole } from '../../services/access.js';
import { toPublicUser } from '../auth/auth.service.js';

function toMember(row) {
  return { ...toPublicUser(row), role: row.role, joinedAt: row.joined_at };
}

export async function listForUser(userId) {
  const rows = await db('workspaces as w')
    .join('workspace_members as m', 'm.workspace_id', 'w.id')
    .where('m.user_id', userId)
    .orderBy('w.created_at', 'asc')
    .select(
      'w.id',
      'w.name',
      'm.role',
      db.raw('(select count(*) from boards b where b.workspace_id = w.id) as board_count'),
      db.raw(
        '(select count(*) from workspace_members x where x.workspace_id = w.id) as member_count',
      ),
    );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    boardCount: r.board_count,
    memberCount: r.member_count,
  }));
}

export async function create(userId, { name }) {
  return db.transaction(async (trx) => {
    const [workspace] = await trx('workspaces')
      .insert({ name, owner_id: userId })
      .returning(['id', 'name']);
    await trx('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
    });
    return { ...workspace, role: 'owner', boardCount: 0, memberCount: 1 };
  });
}

export async function getMembers(workspaceId) {
  const rows = await db('workspace_members as m')
    .join('users as u', 'u.id', 'm.user_id')
    .where('m.workspace_id', workspaceId)
    .orderByRaw("array_position(array['owner','admin','member']::workspace_role[], m.role), u.name")
    .select('u.id', 'u.email', 'u.name', 'u.avatar_color', 'm.role', 'm.joined_at');
  return rows.map(toMember);
}

export async function getDetail(workspaceId, userId) {
  const role = await assertWorkspaceRole(workspaceId, userId);
  const workspace = await db('workspaces').where({ id: workspaceId }).first('id', 'name');
  const boards = await db('boards')
    .where({ workspace_id: workspaceId })
    .orderBy('created_at', 'asc')
    .select('id', 'title', 'description', 'color', 'updated_at');
  return {
    ...workspace,
    role,
    boards: boards.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      color: b.color,
      updatedAt: b.updated_at,
    })),
    members: await getMembers(workspaceId),
  };
}

export async function rename(workspaceId, userId, { name }) {
  await assertWorkspaceRole(workspaceId, userId, 'admin');
  const [row] = await db('workspaces')
    .where({ id: workspaceId })
    .update({ name, updated_at: db.fn.now() })
    .returning(['id', 'name']);
  return row;
}

export async function remove(workspaceId, userId) {
  await assertWorkspaceRole(workspaceId, userId, 'owner');
  await db('workspaces').where({ id: workspaceId }).delete();
}

export async function addMember(workspaceId, actorId, { email, role }) {
  const actorRole = await assertWorkspaceRole(workspaceId, actorId, 'admin');
  if (role === 'admin' && actorRole !== 'owner') {
    throw AppError.forbidden('Only the owner can add admins');
  }
  const user = await db('users').where({ email }).first('id');
  if (!user) throw AppError.notFound('No user registered with that email');

  const exists = await db('workspace_members')
    .where({ workspace_id: workspaceId, user_id: user.id })
    .first();
  if (exists) throw AppError.conflict('User is already a member');

  await db('workspace_members').insert({ workspace_id: workspaceId, user_id: user.id, role });
  return (await getMembers(workspaceId)).find((m) => m.id === user.id);
}

export async function updateMemberRole(workspaceId, actorId, memberId, { role }) {
  await assertWorkspaceRole(workspaceId, actorId, 'owner');
  const target = await db('workspace_members')
    .where({ workspace_id: workspaceId, user_id: memberId })
    .first('role');
  if (!target) throw AppError.notFound('Member not found');
  if (target.role === 'owner') throw AppError.badRequest('The owner role cannot be changed');

  await db('workspace_members')
    .where({ workspace_id: workspaceId, user_id: memberId })
    .update({ role });
  return (await getMembers(workspaceId)).find((m) => m.id === memberId);
}

export async function removeMember(workspaceId, actorId, memberId) {
  const actorRole = await assertWorkspaceRole(workspaceId, actorId);
  const target = await db('workspace_members')
    .where({ workspace_id: workspaceId, user_id: memberId })
    .first('role');
  if (!target) throw AppError.notFound('Member not found');
  if (target.role === 'owner') throw AppError.badRequest('The owner cannot be removed');

  const leavingSelf = actorId === memberId;
  const canRemove =
    leavingSelf || actorRole === 'owner' || (actorRole === 'admin' && target.role === 'member');
  if (!canRemove) throw AppError.forbidden();

  await db.transaction(async (trx) => {
    await trx('workspace_members').where({ workspace_id: workspaceId, user_id: memberId }).delete();
    // Unassign the removed user from cards of this workspace.
    await trx('cards')
      .whereIn('board_id', trx('boards').select('id').where({ workspace_id: workspaceId }))
      .andWhere({ assignee_id: memberId })
      .update({ assignee_id: null });
  });
}
