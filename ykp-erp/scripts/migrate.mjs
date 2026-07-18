// Migrate all four databases sequentially with pg_advisory_xact_lock.
// Uses the shared runner in @ykp/schema so logic is single-source.
// Spawned without a shell to avoid command-injection surface; Node's --import
// loader resolves tsx through the normal module graph.
import { spawn } from "node:child_process";
import process from "node:process";

const child = spawn(process.execPath, [
  "--import",
  "tsx",
  "packages/schema/src/migrate.ts",
], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
  shell: false,
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`[migrate-wrapper] exited with code ${code}`);
    process.exit(code ?? 1);
  }
});

child.on("error", (err) => {
  console.error("[migrate-wrapper] spawn error:", err.message);
  process.exit(1);
});
