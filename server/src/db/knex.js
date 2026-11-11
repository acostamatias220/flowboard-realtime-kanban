import knexFactory from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

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
