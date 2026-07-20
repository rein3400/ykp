import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Root vitest config for the ykp-erp monorepo.
 *
 * Workspace packages are imported via their package.json exports, which point
 * at `./dist/*.js`. Those dist files are not committed, so tests fail unless
 * the package is built first. This config aliases `@ykp/*` imports directly to
 * the TypeScript source so `vitest run` works without a pre-build step.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    timeout: 10_000,
  },
  resolve: {
    alias: {
      "@ykp/engine": path.resolve(__dirname, "packages/engine/src/index.ts"),
      "@ykp/engine/approval": path.resolve(__dirname, "packages/engine/src/approval.ts"),
      "@ykp/engine/audit": path.resolve(__dirname, "packages/engine/src/audit.ts"),
      "@ykp/engine/attendance": path.resolve(__dirname, "packages/engine/src/attendance.ts"),
      "@ykp/engine/client": path.resolve(__dirname, "packages/engine/src/client.ts"),
      "@ykp/engine/cron": path.resolve(__dirname, "packages/engine/src/cron.ts"),
      "@ykp/engine/fin-summary": path.resolve(__dirname, "packages/engine/src/fin-summary.ts"),
      "@ykp/engine/hermez-brief": path.resolve(__dirname, "packages/engine/src/hermez-brief.ts"),
      "@ykp/engine/hr-summary": path.resolve(__dirname, "packages/engine/src/hr-summary.ts"),
      "@ykp/engine/id-gen": path.resolve(__dirname, "packages/engine/src/id-gen.ts"),
      "@ykp/engine/integrations": path.resolve(__dirname, "packages/engine/src/integrations.ts"),
      "@ykp/engine/lookup": path.resolve(__dirname, "packages/engine/src/lookup.ts"),
      "@ykp/engine/moka-importer": path.resolve(__dirname, "packages/engine/src/moka-importer.ts"),
      "@ykp/engine/payroll": path.resolve(__dirname, "packages/engine/src/payroll.ts"),
      "@ykp/engine/telegram": path.resolve(__dirname, "packages/engine/src/telegram.ts"),
      "@ykp/engine/telegram-bot": path.resolve(__dirname, "packages/engine/src/telegram-bot.ts"),
      "@ykp/engine/triggers": path.resolve(__dirname, "packages/engine/src/triggers.ts"),
      "@ykp/engine/wib": path.resolve(__dirname, "packages/engine/src/wib.ts"),
      "@ykp/schema": path.resolve(__dirname, "packages/schema/src/index.ts"),
      "@ykp/auth": path.resolve(__dirname, "packages/auth/src/index.ts"),
      "@ykp/ui": path.resolve(__dirname, "packages/ui/src/index.ts"),
      "@ykp/format": path.resolve(__dirname, "packages/format/src/index.ts"),
      "@ykp/config": path.resolve(__dirname, "packages/config/src/index.ts"),
    },
  },
});
