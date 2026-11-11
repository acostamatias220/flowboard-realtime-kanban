import { db } from './knex.js';

const command = process.argv[2];

async function run() {
  switch (command) {
    case 'migrate': {
      const [batch, files] = await db.migrate.latest();
      console.log(`Batch ${batch}: ${files.length} migration(s) applied`);
      break;
    }
    case 'rollback': {
      const [batch, files] = await db.migrate.rollback();
      console.log(`Batch ${batch}: ${files.length} migration(s) rolled back`);
      break;
    }
    case 'seed': {
      const [files] = await db.seed.run();
      console.log(`${files.length} seed file(s) executed`);
      break;
    }
    case 'reset': {
      await db.migrate.rollback(undefined, true);
      await db.migrate.latest();
      await db.seed.run();
      console.log('Database reset, migrated and seeded');
      break;
    }
    default:
      console.error('Usage: node src/db/cli.js <migrate|rollback|seed|reset>');
      process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.destroy());
