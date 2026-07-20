import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      // Allow importing from './config.js' to resolve to the TypeScript source.
      // Vitest transforms TS on the fly, so the .js extension in imports works.
    }
  }
});
