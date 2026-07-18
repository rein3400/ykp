import { defineConfig } from "drizzle-kit";

// Single drizzle config — schema-qualified tables in one postgres DB.
// Migrations land in packages/schema/migrations/.
export default defineConfig({
  schema: ["./src/master.ts", "./src/hr.ts", "./src/finance.ts", "./src/hermez.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.YKP_DATABASE_URL ?? "postgresql://ykp:change-me@localhost:5432/ykp_erp",
  },
  verbose: true,
  strict: true,
});
