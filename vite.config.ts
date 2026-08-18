import babel from '@rolldown/plugin-babel';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 4280,
  },
  ssr: {
    noExternal: ['@mui/*'],
  },
  plugins: [
    tanstackStart(),
    viteReact(),
    // The React Compiler runs as a Babel pass after the React plugin's oxc
    // transform. reactCompilerPreset scopes it to the client environment and
    // pulls in react/compiler-runtime; React 19 needs no separate runtime shim.
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
