import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config for the HERMEZ database.
 * Migrations land in packages/schema/migrations/hermez/
 */
export default defineConfig({
  schema: "./src/hermez.ts",
  out: "./migrations/hermez",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.YKP_HERMEZ_DATABASE_URL ?? "postgresql://ykp:change-me@localhost:5432/ykp_hermez",
  },
  verbose: true,
  strict: true,
});