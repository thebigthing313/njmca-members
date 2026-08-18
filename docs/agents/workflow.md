# Development Workflow

How every change reaches `main`. Applies to humans and agents alike.

```txt
Plan → GitHub issue → branch off main → build + verify locally → pnpm check → PR → code review → squash merge
```

## Base branch

- Cut every branch from `main`. Every PR targets `main`.
- There is no `develop` branch yet. After the app goes live, `develop` becomes the
  integration base and `main` becomes the release branch. Do not create it early.
  Switching means repointing `pnpm fallow:audit` and the pre-commit hook's
  `FALLOW_AUDIT_BASE_BRANCH` at it too.
- `main` is not branch-protected. The PR flow is convention, not enforcement, so
  follow it rather than pushing straight to `main`.

## 1. Plan

Settle the approach before an issue exists. A plan names the problem, the chosen
approach, and the vertical slices it breaks into. Slice so that each piece is
independently shippable and independently reviewable.

## 2. Issue

One issue per slice, per `docs/agents/issue-tracker.md`, labelled per
`docs/agents/triage-labels.md`. The issue carries the acceptance criteria the PR
will be reviewed against, so write them before opening the branch.

## 3. Branch

```bash
git switch main && git pull
git switch -c feat/12-member-directory
```

Name branches `<type>/<issue-number>-<slug>` using `feat`, `fix`, `chore`,
`refactor`, or `docs`.

## 4. Build

- Domain logic under `src/domain/` is test-first and stays pure. The architecture
  zones in `.fallowrc.jsonc` enforce that arrows only point downward:
  `routes → lib → server → domain`. API routes under `src/routes/api/` are
  server endpoints rather than UI, so they get their own zone that may reach
  `server` directly.
- Verify against local Postgres and the dev server before opening the PR — see
  [Local verification](#local-verification). Unit tests alone do not cover auth,
  migrations, or permission gating.
- Commit one logical change at a time with an imperative subject line.

## 5. Gate

```bash
pnpm check   # lint → typecheck → vitest → fallow audit
```

Everything must pass before the PR opens. The `fallow audit` step also runs as a
git pre-commit hook, scoped to findings the changeset introduces.

## 6. PR

```bash
gh pr create --base main --fill
```

The description links the issue with `Closes #N` and states what was verified
manually — which flows were exercised against local Postgres, and what was not.

## 7. Code review

Review happens on the open PR:

```
/code-review <PR#> --comment
```

Findings land as inline PR comments. Fix them on the branch and push. If the diff
changed materially after fixes, review again.

## 8. Merge

Squash merge, delete the branch, and confirm the issue closed. Anything the review
surfaced but deliberately deferred becomes its own issue before the merge, not a
comment left behind in the code.

## Local verification

Local Postgres is the only database any change is proven against before Railway.

```bash
pnpm db:local:up        # start Postgres in Docker
pnpm db:local:migrate   # Better Auth tables, then reset + seed app-owned tables
pnpm dev                # http://127.0.0.1:4280
```

Required before opening a PR that touches:

| Area | What to exercise |
| --- | --- |
| `src/server/schema.sql`, `dev-seed.sql` | `pnpm db:local:migrate` from a clean volume (`pnpm db:local:destroy` first) |
| Auth, claim, or password reset | `/login`, `/first-time-access`, `/forgot-password` with the seeded `.test` identities |
| Permission or role changes | The dev member switcher on `/login`, across active, inactive, missing-member, and email-mismatch states |
| Admin surfaces | `/admin/members` and `/admin/organizations` as both a permitted and an unpermitted member |

Never point `.env.local` at Railway while running reset or seed commands.

## Fallow

`fallow` is the codebase-health gate. It is installed as a devDependency and
configured in `.fallowrc.jsonc`.

```bash
pnpm fallow          # full report: dead code, duplication, health, boundaries
pnpm fallow:audit    # changed-files gate against origin/main
pnpm fallow:fix      # preview safe automatic cleanups
pnpm fallow:hooks    # force git at .githooks, overriding an existing hooksPath
```

Two hooks enforce it. `.githooks/pre-commit` runs the changed-files audit; it is
tracked, and `pnpm install` points `core.hooksPath` at it through the `prepare`
script. If you already have a `core.hooksPath` of your own, the installer leaves
it alone and says so rather than silently disabling your other hooks — take the
override with `pnpm fallow:hooks` once you have merged the two. The hook audits
against `main`; when `develop` arrives, set `FALLOW_AUDIT_BASE_BRANCH=develop`.

The agent gate in `.claude/settings.json` blocks an agent's `git commit` and
`git push` until the audit passes. That gate needs `jq` on PATH — without it
the gate prints a notice and skips, so install it (`winget install jqlang.jq`) if
you want agent commits gated too.

Only findings a changeset introduces block the gate. Dead code, architecture
boundaries, and private type leaks are clean as of #16, so anything `pnpm fallow`
reports there is yours. Duplication and complexity still carry an inherited
baseline — a full `pnpm fallow` run exits non-zero on it — so read those two
sections against `pnpm fallow:audit`, which attributes findings to your diff.

When fallow flags something, in order of preference: fix it, or suppress the one
line with `// fallow-ignore-next-line <rule> -- reason`, or change the config if
the rule is genuinely wrong for this repo. A suppression without a reason is not
an answer.
