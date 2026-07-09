// Pilot transactional seed wrapper. Spawns the shared seeder via tsx
// (no shell) to keep the existing cross-DB env-var handling in
// @ykp/schema/db/clients.ts as the single source of truth.
import { spawn } from "node:child_process";

const child = spawn("npx", ["tsx", "packages/schema/src/seed-pilot.ts"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
  shell: false,
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`[seed-pilot-wrapper] exited with code ${code}`);
    process.exit(code ?? 1);
  }
});

child.on("error", (err) => {
  console.error("[seed-pilot-wrapper] spawn error:", err.message);
  process.exit(1);
});