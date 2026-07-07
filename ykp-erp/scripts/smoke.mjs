// Runtime smoke checks: can we reach all databases and redis?
import { Client } from "pg";
import Redis from "ioredis";

const DBS = [
  { env: "YKP_MASTER_DATABASE_URL", name: "master" },
  { env: "YKP_HR_DATABASE_URL", name: "hr" },
  { env: "YKP_FINANCE_DATABASE_URL", name: "finance" },
  { env: "YKP_HERMEZ_DATABASE_URL", name: "hermez" },
];

const urlOf = (envName) => {
  const v = process.env[envName];
  if (!v) throw new Error(`Missing ${envName}`);
  return v;
};

let failures = 0;

for (const d of DBS) {
  const client = new Client({ connectionString: urlOf(d.env) });
  try {
    await client.connect();
    const { rows } = await client.query("SELECT current_database() AS db, version() AS v");
    console.log(`[smoke] db ${d.name}: ${rows[0].db}`);
  } catch (err) {
    console.error(`[smoke] db ${d.name}: ${err.message}`);
    failures++;
  } finally {
    await client.end().catch(() => {});
  }
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl);
try {
  const pong = await redis.ping();
  console.log(`[smoke] redis: ${pong}`);
} catch (err) {
  console.error(`[smoke] redis: ${err.message}`);
  failures++;
} finally {
  await redis.quit();
}

if (failures > 0) {
  console.error(`[smoke] ${failures} failure(s)`);
  process.exit(1);
}
console.log("[smoke] ok");