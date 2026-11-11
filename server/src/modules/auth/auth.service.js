import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../../db/knex.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../utils/tokens.js';

const BCRYPT_ROUNDS = 12;
const AVATAR_COLORS = ['#6366f1', '#ec4899', '#0ea5e9', '#22c55e', '#f97316', '#a855f7'];
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

export const publicUserColumns = ['id', 'email', 'name', 'avatar_color'];

export function toPublicUser(row) {
  return { id: row.id, email: row.email, name: row.name, avatarColor: row.avatar_color };
}

async function issueRefreshToken(trx, userId, familyId = crypto.randomUUID()) {
  const token = generateRefreshToken();
  await trx('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashToken(token),
    family_id: familyId,
    expires_at: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  return token;
}

async function createSession(trx, user, familyId) {
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(trx, user.id, familyId),
  };
}

export async function register({ name, email, password }) {
  const existing = await db('users').where({ email }).first('id');
  if (existing) throw AppError.conflict('Email is already registered');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return db.transaction(async (trx) => {
    const [user] = await trx('users')
      .insert({
        name,
        email,
        password_hash: passwordHash,
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      })
      .returning(publicUserColumns);

    // Every new user gets a personal workspace so the app is usable right away.
    const [workspace] = await trx('workspaces')
      .insert({ name: `${name.split(' ')[0]}'s workspace`, owner_id: user.id })
      .returning('id');
    await trx('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    });

    return createSession(trx, user);
  });
}

export async function login({ email, password }) {
  const user = await db('users')
    .where({ email })
    .first([...publicUserColumns, 'password_hash']);
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  return db.transaction((trx) => createSession(trx, user));
}

/**
 * Refresh token rotation with reuse detection:
 * - each refresh token can be used exactly once and is replaced by a new one;
 * - presenting an already rotated token means it was probably stolen, so the
 *   whole token family is revoked and the user must log in again.
 */
export async function refresh(rawToken) {
  if (!rawToken) throw AppError.unauthorized('Missing refresh token');

  // The transaction returns an outcome instead of throwing, so that revoking a
  // compromised family is committed (throwing inside would roll it back).
  const outcome = await db.transaction(async (trx) => {
    const stored = await trx('refresh_tokens')
      .where({ token_hash: hashToken(rawToken) })
      .forUpdate()
      .first();

    if (!stored) return { error: 'Invalid refresh token' };

    if (stored.revoked_at) {
      await trx('refresh_tokens')
        .where({ family_id: stored.family_id })
        .whereNull('revoked_at')
        .update({ revoked_at: trx.fn.now() });
      return { error: 'Refresh token reuse detected' };
    }

    if (new Date(stored.expires_at) <= new Date()) return { error: 'Refresh token expired' };

    await trx('refresh_tokens').where({ id: stored.id }).update({ revoked_at: trx.fn.now() });
    const user = await trx('users').where({ id: stored.user_id }).first(publicUserColumns);
    if (!user) return { error: 'User no longer exists' };

    return { session: await createSession(trx, user, stored.family_id) };
  });

  if (outcome.error) throw AppError.unauthorized(outcome.error);
  return outcome.session;
}

export async function logout(rawToken) {
  if (!rawToken) return;
  const stored = await db('refresh_tokens')
    .where({ token_hash: hashToken(rawToken) })
    .first();
  if (stored) {
    await db('refresh_tokens')
      .where({ family_id: stored.family_id })
      .whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
  }
}

export async function getUser(id) {
  const user = await db('users').where({ id }).first(publicUserColumns);
  if (!user) throw AppError.notFound('User not found');
  return toPublicUser(user);
}
