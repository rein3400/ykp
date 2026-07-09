/**
 * POST /api/admin/migrate — runs Drizzle migrations.
 * Owner-only. Used during initial deploy to apply schema.
 */
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole } from "@ykp/auth";
import { handler, ok, fail } from "@hr/lib/api-error";
import { sql } from "@ykp/schema";
import { resolveBody } from "@hr/lib/zod-resolver";
import { z } from "zod";

const bodySchema = z.object({ confirm: z.literal("MIGRATE") });

export const POST = handler(async (req: NextRequest) => {
  await requireRole([Role.OWNER, Role.SUPER_ADMIN]);
  const parsed = await resolveBody(req, bodySchema);
  if (parsed instanceof Response) return parsed;

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const s = sql();
  await s`SELECT pg_advisory_xact_lock(74213721)`;
  const { getDb } = await import("@ykp/schema");
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "packages/schema/migrations" });
  await s.end();
  return ok({ migrated: true });
});

// Keep ref unused so linter doesn't complain in test mode.
void fail;
void Role;