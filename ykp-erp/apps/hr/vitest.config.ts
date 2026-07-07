import { defineConfig } from "vitest/config";

/**
 * Vitest config for apps/hr. Minimal — we only run unit-style smoke tests
 * that exercise engine helpers and mocked DB clients. Heavy integration
 * tests live in packages/* repos and require real Postgres.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: false,
    timeout: 10_000,
  },
});