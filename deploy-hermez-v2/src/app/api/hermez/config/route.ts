import { eq } from "drizzle-orm";
import { createHermezDb, hermezConfig, hermezAuditLog } from "../../../../../_packages/schema/src";
import { requireSuperAdmin, fail, ok, toIsoString, mapAuthError } from "../_helpers";

export const dynamic = "force-dynamic";

/**
 * GET /api/hermez/config — returns all hermez_config rows.
 * PUT /api/hermez/config { key, value } — upsert a config row.
 * Both require SUPER_ADMIN.
 */
export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }

  const db = createHermezDb();
  try {
    const rows = await db.select().from(hermezConfig).orderBy(hermezConfig.key);
    const items = rows.map((r) => ({
      configId: r.configId,
      key: r.key,
      value: r.value,
      updatedAt: toIsoString(r.updatedAt),
      updatedBy: r.updatedBy,
    }));
    return ok({ items });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez config get]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}

interface PutPayload {
  key?: string;
  value?: string;
}

export async function PUT(req: Request) {
  let user;
  try {
    user = await requireSuperAdmin();
  } catch (err) {
    return mapAuthError(err);
  }

  let body: PutPayload;
  try {
    body = (await req.json()) as PutPayload;
  } catch {
    return fail("validation", "Invalid JSON body", 400);
  }

  if (!body.key || typeof body.key !== "string" || body.key.trim().length === 0) {
    return fail("validation", "key is required", 400);
  }
  if (typeof body.value !== "string") {
    return fail("validation", "value must be a string", 400);
  }

  const db = createHermezDb();
  try {
    const existing = await db
      .select()
      .from(hermezConfig)
      .where(eq(hermezConfig.key, body.key))
      .limit(1);
    const before = existing[0] ?? null;

    const configId = before?.configId ?? `cfg-${body.key}`;
    const updatedAt = new Date();
    const updatedBy = user.email;

    if (before) {
      await db
        .update(hermezConfig)
        .set({ value: body.value, updatedAt, updatedBy })
        .where(eq(hermezConfig.configId, before.configId));
    } else {
      await db.insert(hermezConfig).values({
        configId,
        key: body.key,
        value: body.value,
        updatedAt,
        updatedBy,
      });
    }

    await db.insert(hermezAuditLog).values({
      actor: user.email,
      action: "config.update",
      entity: "hermez_config",
      entityId: body.key,
      before: before ? { value: before.value } : null,
      after: { value: body.value },
      reason: `Threshold update by ${user.role}`,
    });

    return ok({ config: { configId, key: body.key, value: body.value, updatedAt: toIsoString(updatedAt), updatedBy } });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[hermez config put]", e);
    }
    return fail("server", "Internal server error", 500);
  }
}