/**
 * Vitest config for the Finance app. Tests run on the node environment
 * so we can exercise the engine helpers (parseMokaCsv, transitionApproval,
 * generateFinDailySummary) without touching Postgres.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/features": path.resolve(__dirname, "src/features"),
    },
  },
});