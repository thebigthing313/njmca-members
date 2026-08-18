import { spawnSync } from 'node:child_process';

const HOOKS_PATH = '.githooks';

function git(...args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

// Runs from `prepare`, so a tarball install or a checkout without git must not
// fail the install.
if (git('rev-parse', '--git-dir').status !== 0) {
  process.exit(0);
}

const configured = git('config', '--get', 'core.hooksPath').stdout.trim();

if (configured === HOOKS_PATH) {
  process.exit(0);
}

// core.hooksPath replaces the hook directory wholesale rather than merging with
// it, so pointing it at ours would silently disable any commit-msg, pre-push, or
// husky hook already configured. Report the conflict instead of winning it.
if (configured && !process.argv.includes('--force')) {
  console.warn(
    `core.hooksPath is already set to "${configured}", leaving it alone.\n` +
      `The fallow pre-commit gate in ${HOOKS_PATH}/ is not active. Either copy it\n` +
      `into "${configured}", or run: pnpm fallow:hooks --force`,
  );
  process.exit(0);
}

const result = git('config', 'core.hooksPath', HOOKS_PATH);

if (result.status !== 0) {
  console.warn(`Could not set core.hooksPath: ${result.stderr.trim()}`);
}
