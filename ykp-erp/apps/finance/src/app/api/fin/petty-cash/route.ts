/**
 * Petty cash API.
 *  GET  /api/fin/petty-cash?date_from=...&outlet_id=...&account_id=...&type=...&urgent_only=...
 *  POST /api/fin/petty-cash {date,outlet_id,account_id,type,amount,...}
 *
 * amount is asserted positive by zod. urgent_flag triggers an approval
 * workflow via @ykp/engine (DRAFT -> PENDING). Auto-creates a PENDING
 * audit chain when urgent.
 */
import { and, eq, gte, lte, desc } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole, can } from "@ykp/auth";
import { finPettyCash } from "@ykp/schema";
import { getMasterDb, getFinanceDb, type FinanceDb } from "@/lib/server/db.js";
import { handler, ok, fail } from "@/lib/server/http.js";
import { assertOutlet, assertPettyCashAccount, assertExpenseCategory } from "@/lib/server/refs.js";
import { logFinanceAudit } from "@/lib/server/audit.js";
import { financeDayId, transitionApproval } from "@ykp/engine";
import { FinPettyCashQuerySchema, FinPettyCashCreateSchema } from "@/lib/schemas.js";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER,
  ]);
  void user; // available for future RBAC scope checks
  const search = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = FinPettyCashQuerySchema.safeParse(search);
  if (!parsed.success) return fail("validation_error", "Invalid query", parsed.error.flatten());

  const { date_from, date_to, outlet_id, account_id, type, urgent_only, limit } = parsed.data;
  const db = getFinanceDb();

  const conds = [];
  if (date_from) conds.push(gte(finPettyCash.date, date_from));
  if (date_to) conds.push(lte(finPettyCash.date, date_to));
  if (outlet_id) conds.push(eq(finPettyCash.outletId, outlet_id));
  if (account_id) conds.push(eq(finPettyCash.accountId, account_id));
  if (type) conds.push(eq(finPettyCash.type, type));
  if (urgent_only) conds.push(eq(finPettyCash.urgentFlag, true));

  const rows = await db
    .select()
    .from(finPettyCash)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(finPettyCash.recordedAt))
    .limit(limit);

  return ok(rows);
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole([
    Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.OUTLET_MANAGER, Role.STAFF_INPUT,
  ]);
  if (!can(user.role, "petty_cash", "create")) {
    return fail("forbidden", "Role not allowed to create petty cash rows");
  }

  const body = await req.json();
  const parsed = FinPettyCashCreateSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid petty cash payload", parsed.error.flatten());

  const data = parsed.data;
  const masterDb = getMasterDb();
  const financeDb = getFinanceDb();

  // Cross-DB refs — 400 missing_ref if any is unknown. These read from the
  // master DB and run before the finance transaction starts.
  const outlet = await assertOutlet(masterDb, data.outlet_id);
  const account = await assertPettyCashAccount(masterDb, data.account_id);
  if (account.outletId !== data.outlet_id) {
    return fail("missing_ref", `account ${data.account_id} does not belong to outlet ${data.outlet_id}`);
  }
  let categoryName: string | null = null;
  if (data.category_id) {
    categoryName = await assertExpenseCategory(masterDb, data.category_id);
  }
  void categoryName; // retained for future category-name denormalisation

  // Defect F1 fix: the INSERT + the DRAFT->PENDING FSM transition must be
  // atomic. Previously the row was inserted as PENDING first, then
  // transitionApproval ran; if the transition failed, a manual DELETE was
  // needed and a crash between the two left a stuck PENDING row. Now every
  // finance write (pcId allocation, INSERT as DRAFT, optional transition to
  // PENDING, and the audit log entry) runs inside a single transaction. If
  // the transition fails we throw inside the tx, which rolls back the insert
  // automatically. The tx handle is also used for the audit log write.
  try {
    const outcome = await financeDb.transaction(async (tx) => {
      // Allocate pcId with FOR UPDATE so concurrent inserts for the same
      // date+outlet serialise and never collide.
      const existing = await tx
        .select({ pcId: finPettyCash.pcId })
        .from(finPettyCash)
        .where(eq(finPettyCash.date, data.date))
        .for("update");
      const seq = existing.length + 1;
      const pcId = financeDayId(data.date, seq, data.outlet_id);

      // Insert as DRAFT first. The urgent path transitions DRAFT->PENDING
      // below; the non-urgent path stays DRAFT. This matches the FSM
      // (DRAFT -> PENDING) instead of skipping straight to PENDING.
      const [inserted] = await tx
        .insert(finPettyCash)
        .values({
          pcId,
          date: new Date(data.date),
          brandId: outlet.brandId,
          brandName: "",
          outletId: data.outlet_id,
          outletName: outlet.outletName,
          accountId: data.account_id,
          type: data.type,
          amount: data.amount,
          categoryId: data.category_id ?? null,
          description: data.description ?? null,
          attachmentUrl: data.attachment_url ?? null,
          urgentFlag: data.urgent_flag,
          approvalStatus: "DRAFT",
          recordedBy: user.id,
        })
        .returning();

      if (!data.urgent_flag) {
        // Non-urgent: stays DRAFT. Audit the create inside the same tx.
        await logFinanceAudit(tx as unknown as FinanceDb, {
          actor: user.id,
          action: `petty_cash:${data.type}`,
          entity: "fin_petty_cash",
          entityId: inserted.pcId,
          after: inserted,
        });
        return { inserted, status: "DRAFT" as const };
      }

      // Urgent: run the DRAFT -> PENDING transition inside the tx. If it
      // fails we throw, which rolls back the INSERT above automatically.
      const transition = transitionApproval(
        { id: inserted.pcId, entity: "petty_cash", amount: data.amount, status: "DRAFT" },
        "DRAFT",
        "PENDING",
        { id: user.id, role: user.role },
      );
      if (!transition.ok) {
        // Throw a tagged error so the outer catch returns the FSM failure
        // rather than a generic 500. The tx rollback discards the insert.
        const e = Object.assign(new Error(transition.error ?? "Urgent petty cash FSM transition not allowed"), {
          status: 422,
          code: "approval_required",
        });
        throw e;
      }

      // Update the row to PENDING inside the same tx (single source of truth
      // for the approval_status column; the FSM approved the transition).
      const [updated] = await tx
        .update(finPettyCash)
        .set({ approvalStatus: "PENDING", updatedAt: new Date() })
        .where(eq(finPettyCash.pcId, inserted.pcId))
        .returning();

      await logFinanceAudit(tx as unknown as FinanceDb, {
        actor: transition.audit_entry.actor,
        action: transition.audit_entry.action,
        entity: transition.audit_entry.entity,
        entityId: transition.audit_entry.entityId,
        after: updated,
      });

      return { inserted: updated, status: "PENDING" as const };
    });

    return ok({ ...outcome.inserted, approvalStatus: outcome.status }, 201);
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    if (e?.status === 422 && e?.code === "approval_required") {
      return fail("approval_required", e.message ?? "Urgent petty cash FSM transition not allowed");
    }
    // Unexpected infra error: surface as 500 via the handler wrapper.
    throw err;
  }
});