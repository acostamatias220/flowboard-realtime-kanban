/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('columns', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('board_id').notNullable().references('boards.id').onDelete('CASCADE');
    t.string('title', 80).notNullable();
    // Fractional index: items are ordered by position ASC (see utils/ordering.js)
    t.double('position').notNullable();
    t.integer('wip_limit');
    t.timestamps(true, true);
    t.index(['board_id', 'position']);
  });

  await knex.schema.createTable('cards', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('board_id').notNullable().references('boards.id').onDelete('CASCADE');
    t.uuid('column_id').notNullable().references('columns.id').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('description');
    t.double('position').notNullable();
    t.uuid('assignee_id').references('users.id').onDelete('SET NULL');
    t.date('due_date');
    t.uuid('created_by').references('users.id').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['column_id', 'position']);
    t.index(['board_id']);
  });

  await knex.schema.createTable('labels', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('board_id').notNullable().references('boards.id').onDelete('CASCADE');
    t.string('name', 40).notNullable();
    t.string('color', 7).notNullable();
    t.unique(['board_id', 'name']);
  });

  await knex.schema.createTable('card_labels', (t) => {
    t.uuid('card_id').notNullable().references('cards.id').onDelete('CASCADE');
    t.uuid('label_id').notNullable().references('labels.id').onDelete('CASCADE');
    t.primary(['card_id', 'label_id']);
  });

  await knex.schema.createTable('comments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('card_id').notNullable().references('cards.id').onDelete('CASCADE');
    t.uuid('author_id').notNullable().references('users.id').onDelete('CASCADE');
    t.text('body').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['card_id', 'created_at']);
  });

  await knex.schema.createTable('activities', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('board_id').notNullable().references('boards.id').onDelete('CASCADE');
    t.uuid('user_id').references('users.id').onDelete('SET NULL');
    t.string('action', 40).notNullable();
    t.uuid('entity_id');
    t.jsonb('meta').notNullable().defaultTo('{}');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['board_id', 'id']);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('activities');
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.dropTableIfExists('card_labels');
  await knex.schema.dropTableIfExists('labels');
  await knex.schema.dropTableIfExists('cards');
  await knex.schema.dropTableIfExists('columns');
}
