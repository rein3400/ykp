// Dev seed for local databases. Uses shared seeder in @ykp/schema.
// Spawned via execFile (no shell) to avoid command-injection surface.
import { spawn } from "node:child_process";

const child = spawn("npx", ["tsx", "packages/schema/src/seed.ts"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
  shell: false,
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`[seed-wrapper] exited with code ${code}`);
    process.exit(code ?? 1);
  }
});

child.on("error", (err) => {
  console.error("[seed-wrapper] spawn error:", err.message);
  process.exit(1);
});