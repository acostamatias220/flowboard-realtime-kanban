import crypto from 'node:crypto';
import fs from 'node:fs';

process.env.NODE_ENV = 'test';

// Load server/.env locally (CI provides the variables directly).
if (fs.existsSync('.env')) process.loadEnvFile('.env');

// Tests never need a real secret: use a random one per run when none is provided.
process.env.JWT_ACCESS_SECRET ||= crypto.randomBytes(48).toString('hex');
