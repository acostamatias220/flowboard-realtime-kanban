import './env.js';

/** Runs migrations once against the test database before the suites start. */
export default async function setup() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must be set to run the test suite');
  }
  const { db } = await import('../../src/db/knex.js');
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
  await db.destroy();
}
