import http from 'node:http';
import { env } from './config/env.js';
import { db } from './db/knex.js';
import { createApp } from './app.js';
import { createSocketServer } from './realtime/socket.js';

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  io.close();
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
