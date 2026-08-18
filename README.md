# NJMCA Members

Members portal for the New Jersey Mosquito Control Association.

## Stack

- React + TypeScript
- TanStack Start
- TanStack Router
- MUI
- Railway Postgres

## Local Setup

This project runs on Node 22.13 or newer and pnpm 11, pinned by the
`packageManager` field. The Node floor comes from pnpm 11 itself, which
declares `engines.node: >=22.13`; `.nvmrc` pins the same.

If you drive pnpm through a standalone launcher rather than corepack — a
Chocolatey, Homebrew, or `npm i -g pnpm` install — upgrade it to match the
pinned major. An older launcher can fail to self-switch, aborting with
`Failed to switch pnpm to v11.22.0` and leaving an incomplete install behind
rather than falling back to what it has. A Chocolatey 10.13.1 launcher failed
this way here. `corepack pnpm ...` is unaffected either way.

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Start local Postgres and create local environment variables.

   ```bash
   pnpm db:local:up
   cp .env.local.example .env.local
   ```

   Keep `DATABASE_URL` pointed at `127.0.0.1:54329` for local development so migrations are exercised locally before Railway.

3. Apply local schemas and seed data.

   ```bash
   pnpm db:local:migrate
   ```

   This runs the Better Auth CLI migration against local Postgres, then resets and seeds the app-owned member, role, permission, claim, and audit tables.

4. Start the dev server.

   ```bash
   pnpm dev
   ```

## TypeScript

Two TypeScript versions are installed, deliberately.

- `typescript` (6.x) is the compiler API everything else builds on. ESLint needs
  it: `typescript-eslint` throws on import under TypeScript 7, whose default
  export is only a version string. Version 7 does ship an API, but behind
  `./unstable/*` and not yet in the 6.x shape. The editor's language service
  reads this copy too.
- `typescript-7` aliases TypeScript 7, the Go port. `pnpm typecheck` is its only
  consumer, and it takes a cold `tsc -b` here from roughly 10 seconds to 2.

That script invokes the compiler by path rather than by name, because both
packages claim the `tsc` bin and the winner of that link is simply whichever one
pnpm linked last. `pnpm exec tsc` is therefore ambiguous; prefer `pnpm typecheck`.

Lint never type-checks — no type-aware rules are configured, so TypeScript 6 only
parses. The editor does type-check, though, and it uses 6 while the gate uses 7.
TypeScript 7 is a reimplementation rather than a recompile, so the two can
disagree. `pnpm check` is the authority; a clean editor is not a passing build.

Collapse this back to a single `typescript` on plain `tsc` once typescript-eslint
supports TypeScript 7.1
([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)),
which waits on that `unstable/*` API settling into a stable one.

## Contributing

Every change follows the same loop: plan, open a GitHub issue, branch off `main`,
build it, verify against local Postgres, then open a PR for review and squash merge.
`docs/agents/workflow.md` is the full description; the short version is:

```bash
git switch -c feat/12-member-directory
pnpm check                       # lint, typecheck, tests, fallow audit
gh pr create --base main --fill
```

`pnpm check` must pass before a PR opens. `pnpm install` also points git at the
tracked `.githooks/` directory, so the fallow pre-commit gate works from a fresh
clone with no extra setup. If you already have your own `core.hooksPath`, the
installer leaves it in place and tells you how to opt in.

## Codebase Health

[fallow](https://docs.fallow.tools) watches for dead code, duplication, complexity,
and architecture drift. `.fallowrc.jsonc` encodes the layering the app assumes:
`routes → lib → server → domain`, with domain modules staying pure.

- `pnpm fallow`: full report across the whole codebase.
- `pnpm fallow:audit`: gate the current branch's changes against `origin/main`.
- `pnpm fallow:fix`: preview safe automatic cleanups.

Only findings a changeset introduces block the gate.

## Database Workflow

- `pnpm db:local:up`: start local Postgres with Docker Compose.
- `pnpm db:local:migrate`: apply Better Auth tables, reset app-owned tables, and seed development data.
- `pnpm db:app:migrate`: apply only app-owned schema.
- `pnpm db:app:seed`: apply only app-owned development seed data.
- `pnpm db:app:reset`: drop and recreate app-owned tables. This refuses to run unless `DATABASE_URL` points at localhost.
- `pnpm db:local:destroy`: stop local Postgres and delete its Docker volume.

Do not point `.env.local` at Railway while using reset commands. Use Railway only after local schema and flow testing passes.

## Demo

The app has a protected `/portal` route. In development, `/login` includes fake `.test` member identities for testing active, inactive, missing-member, and email-mismatch access states without production impersonation. `/first-time-access` starts the member claim flow for an active unlinked member, and `/forgot-password` handles OTP-based password reset. The first admin tracer is `/admin/members`, guarded by the `manage_members` permission.

## Email Testing

OTP delivery is controlled by `NJMCA_EMAIL_DELIVERY`:

- `console`: local/default development mode. OTPs are logged server-side and no email leaves the app.
- `resend-test`: sends through Resend to `RESEND_TEST_RECIPIENT`, which should use a Resend test address such as `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, or `suppressed@resend.dev`.
- `resend`: sends through Resend to the real member email. Use this for production and manual acceptance against a verified sending domain.
