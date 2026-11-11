/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email', 255).notNullable().unique();
    t.string('name', 80).notNullable();
    t.string('password_hash', 100).notNullable();
    t.string('avatar_color', 7).notNullable().defaultTo('#6366f1');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    // Only a SHA-256 hash of the opaque token is stored, never the token itself.
    t.string('token_hash', 64).notNullable().unique();
    // Tokens issued by rotation share the same family, used for reuse detection.
    t.uuid('family_id').notNullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['family_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
}
