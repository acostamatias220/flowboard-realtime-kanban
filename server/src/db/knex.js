import knexFactory from 'knex';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

// Return DATE columns as 'YYYY-MM-DD' strings (avoids timezone shifts) and
// BIGINT/COUNT values as numbers (safe for the sizes handled by this app).
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(20, (value) => Number.parseInt(value, 10));

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const knexConfig = {
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: path.join(dirname, 'migrations'),
    tableName: 'knex_migrations',
    loadExtensions: ['.js'],
  },
  seeds: {
    directory: path.join(dirname, 'seeds'),
    loadExtensions: ['.js'],
  },
};

export const db = knexFactory(knexConfig);
