## Development workflow

Every change goes plan → GitHub issue → branch off `main` → PR → code review → squash
merge, verified against local Postgres and gated by `pnpm check`. See
`docs/agents/workflow.md` before starting work.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live in GitHub Issues for `thebigthing313/njmca-members`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo: use root `CONTEXT.md` and `docs/adr/` when present. See `docs/agents/domain.md`.
