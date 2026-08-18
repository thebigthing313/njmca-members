# NJMCA Members

Members portal for the New Jersey Mosquito Control Association.

## Stack

- React + TypeScript
- TanStack Start
- TanStack Router
- MUI
- Railway Postgres

## Local Setup

This project runs on Node 22 or newer (`.nvmrc` pins the major) and pnpm 11,
pinned by the `packageManager` field.

If you drive pnpm through a standalone launcher rather than corepack — a
Chocolatey, Homebrew, or `npm i -g pnpm` install — it must be 11.x or newer.
pnpm 11 moved its binary and dropped the `bin/` shims that older launchers
look for when self-switching, so a 10.x launcher fails with
`Failed to switch pnpm to v11` instead of falling back. `corepack pnpm ...`
works regardless.

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
