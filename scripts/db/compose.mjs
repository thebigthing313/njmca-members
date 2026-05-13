import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const modernResult = spawnSync('docker', ['compose', ...args], {
  shell: process.platform === 'win32',
  stdio: 'pipe',
});

if (modernResult.status === 0) {
  process.stdout.write(modernResult.stdout);
  process.stderr.write(modernResult.stderr);
  process.exit(0);
}

const legacyResult = spawnSync('docker-compose', args, {
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (legacyResult.error) {
  process.stderr.write(modernResult.stderr);
  throw legacyResult.error;
}

process.exit(legacyResult.status ?? 1);
