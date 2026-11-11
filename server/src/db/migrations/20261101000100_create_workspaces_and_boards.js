/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('workspaces', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 80).notNullable();
    t.uuid('owner_id').notNullable().references('users.id').onDelete('CASCADE');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('workspace_members', (t) => {
    t.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.enu('role', ['owner', 'admin', 'member'], {
      useNative: true,
      enumName: 'workspace_role',
    })
      .notNullable()
      .defaultTo('member');
    t.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(['workspace_id', 'user_id']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('boards', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('workspace_id').notNullable().references('workspaces.id').onDelete('CASCADE');
    t.string('title', 120).notNullable();
    t.text('description');
    t.string('color', 7).notNullable().defaultTo('#6366f1');
    t.uuid('created_by').references('users.id').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['workspace_id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('boards');
  await knex.schema.dropTableIfExists('workspace_members');
  await knex.raw('DROP TYPE IF EXISTS workspace_role');
  await knex.schema.dropTableIfExists('workspaces');
}
