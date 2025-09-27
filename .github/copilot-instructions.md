# Copilot Coding Agent Onboarding Instructions

## High-Level Overview

**Repository Purpose:**  
This repository is a members-only web application for organizations, built with React, Vite, TanStack (Router, Query, Form, Table), and Supabase. It provides authentication, member management, event scheduling, document/resource sharing, and administrative features.

**Project Type & Size:**

- Medium-sized monorepo (~200+ source files)
- Main stack: React (TypeScript), Vite, TanStack, Supabase, TailwindCSS
- Uses pnpm for package management

**Key Technologies:**

- React 19, TypeScript 5
- Vite 6
- TanStack Router, Query, Form, Table
- Supabase (auth, storage, database)
- TailwindCSS
- ESLint for linting

---

## Build, Run, and Validate Instructions

**Environment Setup:**

- Node.js 20+ recommended
- pnpm required (`npm install -g pnpm`)
- Supabase CLI required for local dev (`npm install -g supabase`)
- Always run `pnpm install` after cloning or pulling changes

**Bootstrap:**

```sh
pnpm install
```

- Always run before build, dev, or test.

**Development Server:**

```sh
pnpm dev
```

- Starts Vite dev server with HMR.

**Build:**

```sh
pnpm build
```

- Runs TypeScript compiler and Vite build.

**Lint:**

```sh
pnpm lint
```

- Uses ESLint with TypeScript and React rules.

**Preview Production Build:**

```sh
pnpm preview
```

- Serves the built app locally.

**Supabase Local Development:**

```sh
supabase start
```

- Starts local Supabase services.
- Requires `supabase/config.toml` and schema files in `supabase/schema/`.

**Testing:**

- No test scripts found; add tests in `src/` and update `package.json` as needed.

**Common Issues & Workarounds:**

- If build fails, ensure all dependencies are installed and Supabase is running.
- If TypeScript errors occur, check `tsconfig.json` and `tsconfig.node.json`.
- If lint fails, fix issues per ESLint output; rules are strict (`max-warnings 0`).

---

## Project Layout & Architecture

**Root Files:**

- `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `.eslintrc.cjs`, `README.md`, `plan.md`
- `.vscode/settings.json` for editor preferences
- `.github/copilot-instructions.md` (this file)

**Source Code:**

- `src/` — main app code
  - `components/` — UI and feature components
  - `hooks/` — custom React hooks
  - `lib/` — Supabase client, utilities
  - `routes/` — TanStack Router route files
  - `types/` — TypeScript type definitions

**Supabase:**

- `supabase/config.toml` — Supabase CLI config
- `supabase/schema/` — SQL schema files

**Configuration:**

- `vite.config.ts` — Vite and plugin setup
- `tsconfig.json` — TypeScript config
- `.eslintrc.cjs` — ESLint config

**Key Entry Points:**

- `src/main.tsx` — React app entry
- `src/routes/__root.tsx` — Root route, sets up QueryClient and RouterProvider

**Checks Before Commit:**

- Run `pnpm lint` and `pnpm build` before submitting changes.
- No automated CI/CD workflows found; validate locally.

---

## Validation Steps

1. Always run `pnpm install` after pulling changes.
2. Start Supabase locally with `supabase start` if using database features.
3. Run `pnpm dev` to verify the app starts.
4. Run `pnpm lint` and fix all warnings/errors.
5. Run `pnpm build` to ensure production build succeeds.
6. If adding new features, update or add relevant files in `src/components/`, `src/routes/`, and `src/types/`.

---

## Style Preferences

- Use **tabs** for indentation (not spaces).
- Always terminate statements with **semicolons**.
- Use **single quotes** for strings.
- Prefer **function components** in React.
- Use **arrow functions** for event handlers and callbacks.
- Explicitly type variables, props, and functions wherever possible.
- Prefer **interface** for TypeScript type definitions (especially for functions/components).
- Use **absolute imports** (e.g., `@/components/...`).
- When autocompleting SQL, use **lowercase PostgreSQL syntax**.
- All file names should be **lowercase kebab-case** (e.g., `my-component.tsx`).

## Additional Notes

- Trust these instructions; only search the codebase if information here is incomplete or in error.
- For new features, follow the architecture plan in `plan.md`.
- Use TanStack Query for server state, React Context for global state, and TanStack Form for forms.
- Use Zod for input validation and enforce role-based access control.
- All configuration and linting files are in the repo root.
