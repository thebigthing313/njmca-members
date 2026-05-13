import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

import { loadLocalEnv } from './env.mjs';

const { Client } = pg;
const command = process.argv[2] ?? 'migrate';
const appTableNames = [
  'member_roles',
  'role_permissions',
  'roles',
  'permissions',
  'member_claims',
  'audit_events',
  'members',
];

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy .env.local.example to .env.local.');
}

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();

  switch (command) {
    case 'migrate':
      await applySqlFile('src/server/schema.sql');
      break;
    case 'seed':
      await applySqlFile('src/server/dev-seed.sql');
      break;
    case 'reset':
      assertLocalDatabase(databaseUrl);
      await dropAppTables();
      await applySqlFile('src/server/schema.sql');
      await applySqlFile('src/server/dev-seed.sql');
      break;
    default:
      throw new Error(`Unknown command "${command}". Use migrate, seed, or reset.`);
  }
} finally {
  await client.end();
}

async function applySqlFile(relativePath) {
  const filePath = resolve(process.cwd(), relativePath);
  const sql = readFileSync(filePath, 'utf8');

  await client.query(sql);
  console.log(`Applied ${relativePath}`);
}

async function dropAppTables() {
  await client.query(
    `drop table if exists ${appTableNames.join(', ')} cascade`,
  );
  console.log('Dropped app-owned tables');
}

function assertLocalDatabase(url) {
  const parsedUrl = new URL(url);
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);

  if (!localHosts.has(parsedUrl.hostname)) {
    throw new Error(
      `Refusing to reset a non-local database at ${parsedUrl.hostname}.`,
    );
  }
}
