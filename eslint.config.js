import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '.output/**', 'src/routeTree.gen.ts'],
  },
  {
    // A suppression that stops matching a real finding should fail the gate
    // rather than linger. Flat config only warns about these by default.
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  {
    // Application source. Browser globals, since anything server-only still
    // ships through the same TanStack Start build.
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // A file route exports `Route` and keeps its component local, because
    // createFileRoute references the component rather than importing it. The
    // rule wants the component exported instead, and exporting it produces an
    // unused export that fallow's dead-code gate rejects — the two gates
    // contradict each other here, and the export exists only to satisfy the
    // linter. The cost is that editing a route triggers a full reload instead of
    // a state-preserving refresh.
    //
    // The rule stays on everywhere else, so it applies to the component modules
    // the split in #24 will create.
    files: ['src/routes/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Node scripts and this config file. Not linted before the flat-config
    // migration; the eslintrc setup only reached .ts and .tsx.
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
