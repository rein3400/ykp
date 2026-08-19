import { defineConfig } from 'vitest/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // CONFIG.dataDir is read at module load, so it must be set before import.
    env: {
      HERMEZ_DATA_DIR: join(tmpdir(), 'hermez-test-data'),
    },
  },
});
