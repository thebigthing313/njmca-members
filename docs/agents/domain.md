# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root, if present.
- `docs/adr/`, if present, for architectural decisions that touch the area being changed.

If these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. Producer skills can create them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repo:

```txt
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`. If the concept is missing, either avoid inventing new language or note the gap for a future documentation pass.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
