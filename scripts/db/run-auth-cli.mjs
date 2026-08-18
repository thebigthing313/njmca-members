import { spawnSync } from 'node:child_process';

import { loadLocalEnv } from './env.mjs';

loadLocalEnv();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.local.example to .env.local.');
}

const cliArgs = [
  'pnpm',
  'dlx',
  'auth@latest',
  ...process.argv.slice(2),
  '--config',
  './src/server/auth.ts',
  '--yes',
];

const result = spawnSync('corepack', cliArgs, {
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
