import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const STEP = 1024;

const demoUsers = [
  { email: 'ana@demo.dev', name: 'Ana López', avatar_color: '#ec4899' },
  { email: 'bruno@demo.dev', name: 'Bruno Díaz', avatar_color: '#0ea5e9' },
  { email: 'carla@demo.dev', name: 'Carla Gómez', avatar_color: '#22c55e' },
];

const columns = [
  {
    title: 'Backlog',
    cards: [
      { title: 'Definir roadmap del Q1', labels: ['Producto'] },
      { title: 'Investigar exportación a CSV', labels: ['Backend'] },
      { title: 'Modo oscuro', labels: ['Frontend', 'UX'] },
    ],
  },
  {
    title: 'En progreso',
    cards: [
      {
        title: 'Notificaciones por email',
        labels: ['Backend'],
        description: 'Enviar un resumen diario con las tarjetas vencidas.',
        assignee: 1,
        dueInDays: 5,
      },
      { title: 'Rediseño del header', labels: ['Frontend'], assignee: 0, dueInDays: 2 },
    ],
  },
  {
    title: 'Revisión',
    cards: [{ title: 'Tests de integración de auth', labels: ['Backend', 'QA'], assignee: 2 }],
  },
  {
    title: 'Hecho',
    cards: [
      { title: 'Configurar CI en GitHub Actions', labels: ['DevOps'] },
      { title: 'Docker compose para desarrollo', labels: ['DevOps'] },
    ],
  },
];

const labelColors = {
  Producto: '#a855f7',
  Backend: '#0ea5e9',
  Frontend: '#f97316',
  UX: '#ec4899',
  QA: '#eab308',
  DevOps: '#22c55e',
};

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  let password = process.env.SEED_USER_PASSWORD;
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url');
    console.log(`SEED_USER_PASSWORD not set. Generated demo password: ${password}`);
  }

  await knex.raw(
    'TRUNCATE activities, comments, card_labels, labels, cards, columns, boards, workspace_members, workspaces, refresh_tokens, users RESTART IDENTITY CASCADE',
  );

  const passwordHash = await bcrypt.hash(password, 12);
  const users = await knex('users')
    .insert(demoUsers.map((u) => ({ ...u, password_hash: passwordHash })))
    .returning(['id', 'email']);

  const [workspace] = await knex('workspaces')
    .insert({ name: 'Acme Studio', owner_id: users[0].id })
    .returning('id');

  await knex('workspace_members').insert([
    { workspace_id: workspace.id, user_id: users[0].id, role: 'owner' },
    { workspace_id: workspace.id, user_id: users[1].id, role: 'admin' },
    { workspace_id: workspace.id, user_id: users[2].id, role: 'member' },
  ]);

  const [board] = await knex('boards')
    .insert({
      workspace_id: workspace.id,
      title: 'Lanzamiento v1.0',
      description: 'Tareas para el primer release público.',
      created_by: users[0].id,
    })
    .returning('id');

  const labels = await knex('labels')
    .insert(
      Object.entries(labelColors).map(([name, color]) => ({ board_id: board.id, name, color })),
    )
    .returning(['id', 'name']);
  const labelId = Object.fromEntries(labels.map((l) => [l.name, l.id]));

  for (const [colIndex, col] of columns.entries()) {
    const [column] = await knex('columns')
      .insert({ board_id: board.id, title: col.title, position: (colIndex + 1) * STEP })
      .returning('id');

    for (const [cardIndex, c] of col.cards.entries()) {
      const due = c.dueInDays ? new Date(Date.now() + c.dueInDays * 86_400_000) : null;
      const [card] = await knex('cards')
        .insert({
          board_id: board.id,
          column_id: column.id,
          title: c.title,
          description: c.description ?? null,
          position: (cardIndex + 1) * STEP,
          assignee_id: c.assignee !== undefined ? users[c.assignee].id : null,
          due_date: due ? due.toISOString().slice(0, 10) : null,
          created_by: users[0].id,
        })
        .returning('id');

      if (c.labels?.length) {
        await knex('card_labels').insert(
          c.labels.map((name) => ({ card_id: card.id, label_id: labelId[name] })),
        );
      }
      if (cardIndex === 0 && colIndex === 1) {
        await knex('comments').insert({
          card_id: card.id,
          author_id: users[2].id,
          body: '¿Usamos una cola de trabajos para no bloquear la API?',
        });
      }
    }
  }

  await knex('activities').insert({
    board_id: board.id,
    user_id: users[0].id,
    action: 'board.created',
    entity_id: board.id,
    meta: { title: 'Lanzamiento v1.0' },
  });
}
