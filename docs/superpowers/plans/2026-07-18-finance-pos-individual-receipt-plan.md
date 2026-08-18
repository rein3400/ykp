# Finance POS Individual Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `fin_pos_daily` daily aggregates with individual receipt records, expose a daily aggregate view, and add photo-nota upload per receipt for fraud-proof POS revenue tracking.

**Architecture:** Receipts become the source of truth in `finance.fin_pos_receipts`; a new database view `fin_pos_daily_view` reproduces the existing `fin_pos_daily` shape so Hermez/analytics remain compatible. Moka CSV import is rewritten to insert per receipt, and the manual POS form gains a photo upload field backed by Supabase Storage.

**Tech Stack:** Next.js 14, Drizzle ORM, PostgreSQL, Supabase Storage, TanStack Query, shadcn/ui (`@ykp/ui`), TypeScript, vitest.

---

## File Map

- `ykp-erp/packages/schema/src/finance.ts` — new schema definitions.
- `ykp-erp/packages/schema/src/migrate.ts` — migration that creates tables, migrates legacy data, drops old table, creates view.
- `ykp-erp/packages/engine/src/moka-importer.ts` — receipt-level parser.
- `ykp-erp/packages/engine/src/id-gen.ts` — add receipt ID generator.
- `ykp-erp/apps/finance/src/app/api/fin/pos/route.ts` — switch GET to view, POST moved to receipts sub-route (legacy POST kept as redirect or removed).
- `ykp-erp/apps/finance/src/app/api/fin/pos/import/route.ts` — insert per receipt.
- `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/route.ts` — list/create receipts.
- `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/[id]/route.ts` — detail/delete.
- `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/[id]/verify/route.ts` — verify receipt.
- `ykp-erp/apps/finance/src/app/api/fin/pos/upload/route.ts` — signed Supabase upload URL or proxy upload.
- `ykp-erp/apps/finance/src/features/finance/api/types.ts` — receipt types.
- `ykp-erp/apps/finance/src/features/finance/api/queries.ts` — receipt queries.
- `ykp-erp/apps/finance/src/features/finance/api/mutations.ts` — receipt mutations.
- `ykp-erp/apps/finance/src/features/finance/api/service.ts` — receipt service calls.
- `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-table.tsx` — receipt drill-down table.
- `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-form.tsx` — manual receipt form with photo.
- `ykp-erp/apps/finance/src/features/finance/components/pos-photo-upload.tsx` — shared photo upload.
- `ykp-erp/apps/finance/src/app/(dashboard)/pos/page.tsx` — daily view + drill-down.
- `ykp-erp/apps/finance/src/lib/supabase.ts` — Supabase storage client.
- `ykp-erp/packages/config/src/index.ts` — add storage bucket constant.

---

### Task 1: Schema + Migration

**Files:**
- Modify: `ykp-erp/packages/schema/src/finance.ts`
- Modify: `ykp-erp/packages/schema/src/migrate.ts`

- [ ] **Step 1: Add `fin_pos_receipts` table definition**

  Add after `finPosDaily` block in `finance.ts`:

  ```ts
  export const posSourceEnum = finance.enum("pos_source", ["moka", "manual", "import", "receipt"]);

  export const finPosReceipts = finance.table("fin_pos_receipts", {
    receiptId: text("receipt_id").primaryKey(),
    date: date("date", { mode: "date" }).notNull(),
    brandId: text("brand_id").notNull(),
    brandName: text("brand_name").notNull(),
    outletId: text("outlet_id").notNull(),
    outletName: text("outlet_name").notNull(),
    receiptNumber: text("receipt_number").notNull(),
    transactionTime: text("transaction_time"),
    grossSales: integer("gross_sales").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    refund: integer("refund").notNull().default(0),
    void: integer("void").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    serviceCharge: integer("service_charge").notNull().default(0),
    netSales: integer("net_sales").notNull().default(0),
    paymentMethodId: text("payment_method_id"),
    paymentAmount: integer("payment_amount").notNull().default(0),
    paymentBreakdown: jsonb("payment_breakdown").notNull().default({}),
    transactionCount: integer("transaction_count").notNull().default(1),
    cashier: text("cashier"),
    shift: text("shift"),
    source: posSourceEnum("source").notNull().default("manual"),
    sourceRef: text("source_ref"),
    notes: text("notes"),
    photoUrl: text("photo_url"),
    photoPath: text("photo_path"),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { mode: "date" }),
    recordedBy: text("recorded_by"),
    recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  }, (t) => ({
    dateOutletReceiptUnique: unique("fin_pos_receipts_date_outlet_receipt_unique").on(t.date, t.outletId, t.receiptNumber),
  }));
  ```

  Also export inferred types at the bottom:

  ```ts
  export type FinPosReceipt = typeof finPosReceipts.$inferSelect;
  export type NewFinPosReceipt = typeof finPosReceipts.$inferInsert;
  ```

- [ ] **Step 2: Replace `finPosDaily` with `finPosDailyView` helper**

  Keep the old `finPosDaily` table export but mark it deprecated in a comment so existing code can be searched. Do not rename types yet to avoid a massive import refactor. Instead, add a new `finPosDailyView` helper that points to a raw SQL view. We will create the actual view in the migration.

  Add in `finance.ts`:

  ```ts
  // Aggregate view over fin_pos_receipts; replaces the old daily table as source of truth.
  export const finPosDailyView = finance.view("fin_pos_daily_view", {
    posId: text("pos_id"),
    date: date("date", { mode: "date" }),
    brandId: text("brand_id"),
    brandName: text("brand_name"),
    outletId: text("outlet_id"),
    outletName: text("outlet_name"),
    grossSales: integer("gross_sales"),
    netSales: integer("net_sales"),
    discount: integer("discount"),
    refund: integer("refund"),
    void: integer("void"),
    tax: integer("tax"),
    serviceCharge: integer("service_charge"),
    paymentMethodBreakdown: jsonb("payment_method_breakdown"),
    transactionCount: integer("transaction_count"),
    aov: integer("aov"),
    cashier: text("cashier"),
    shift: text("shift"),
    source: text("source"),
    sourceRef: text("source_ref"),
    notes: text("notes"),
    recordedAt: timestamp("recorded_at", { mode: "date" }),
    recordedBy: text("recorded_by"),
    createdAt: timestamp("created_at", { mode: "date" }),
    updatedAt: timestamp("updated_at", { mode: "date" }),
  }).existing();
  ```

- [ ] **Step 3: Add migration step in `migrate.ts`**

  In the finance migration sequence, after the current tables are created, add a new migration step `finance_v2_receipts`:

  ```ts
  // finance_v2_receipts: create receipts table, migrate legacy fin_pos_daily, drop table, create view
  async function financeV2Receipts(db: PostgresJsDatabase) {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS finance.fin_pos_receipts (
        receipt_id text PRIMARY KEY,
        date date NOT NULL,
        brand_id text NOT NULL,
        brand_name text NOT NULL,
        outlet_id text NOT NULL,
        outlet_name text NOT NULL,
        receipt_number text NOT NULL,
        transaction_time text,
        gross_sales integer NOT NULL DEFAULT 0,
        discount integer NOT NULL DEFAULT 0,
        refund integer NOT NULL DEFAULT 0,
        void integer NOT NULL DEFAULT 0,
        tax integer NOT NULL DEFAULT 0,
        service_charge integer NOT NULL DEFAULT 0,
        net_sales integer NOT NULL DEFAULT 0,
        payment_method_id text,
        payment_amount integer NOT NULL DEFAULT 0,
        payment_breakdown jsonb NOT NULL DEFAULT '{}',
        transaction_count integer NOT NULL DEFAULT 1,
        cashier text,
        shift text,
        source finance.pos_source NOT NULL DEFAULT 'manual',
        source_ref text,
        notes text,
        photo_url text,
        photo_path text,
        verified_by text,
        verified_at timestamp,
        recorded_by text,
        recorded_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE (date, outlet_id, receipt_number)
      );

      -- Migrate legacy fin_pos_daily rows into receipts
      INSERT INTO finance.fin_pos_receipts (
        receipt_id, date, brand_id, brand_name, outlet_id, outlet_name,
        receipt_number, gross_sales, discount, refund, void, tax, service_charge,
        net_sales, payment_breakdown, transaction_count, aov_numerator, cashier, shift,
        source, source_ref, notes, recorded_by, recorded_at, created_at, updated_at
      )
      SELECT
        'RCP-' || to_char(d.date, 'YYYYMMDD') || '-' || d.outlet_id || '-LEGACY-' || row_number() OVER (PARTITION BY d.date, d.outlet_id ORDER BY d.created_at),
        d.date, d.brand_id, d.brand_name, d.outlet_id, d.outlet_name,
        'LEGACY-' || to_char(d.date, 'YYYYMMDD') || '-' || d.outlet_id,
        d.gross_sales, d.discount, d.refund, d.void, d.tax, d.service_charge,
        d.net_sales, d.payment_method_breakdown, d.transaction_count, 0,
        d.cashier, d.shift, d.source, d.source_ref, d.notes, d.recorded_by, d.recorded_at, d.created_at, d.updated_at
      FROM finance.fin_pos_daily d
      ON CONFLICT (date, outlet_id, receipt_number) DO NOTHING;

      DROP TABLE IF EXISTS finance.fin_pos_daily CASCADE;

      CREATE OR REPLACE VIEW finance.fin_pos_daily_view AS
      SELECT
        'POS-' || to_char(r.date, 'YYYYMMDD') || '-' || r.outlet_id AS pos_id,
        r.date,
        r.brand_id,
        r.brand_name,
        r.outlet_id,
        r.outlet_name,
        COALESCE(SUM(r.gross_sales), 0) AS gross_sales,
        COALESCE(SUM(r.net_sales), 0) AS net_sales,
        COALESCE(SUM(r.discount), 0) AS discount,
        COALESCE(SUM(r.refund), 0) AS refund,
        COALESCE(SUM(r.void), 0) AS void,
        COALESCE(SUM(r.tax), 0) AS tax,
        COALESCE(SUM(r.service_charge), 0) AS service_charge,
        COALESCE(
          jsonb_object_agg(pm.method_id, pm.total) FILTER (WHERE pm.method_id IS NOT NULL),
          '{}'::jsonb
        ) AS payment_method_breakdown,
        COALESCE(SUM(r.transaction_count), 0) AS transaction_count,
        CASE WHEN COALESCE(SUM(r.transaction_count), 0) > 0
          THEN ROUND(SUM(r.net_sales) / SUM(r.transaction_count))
          ELSE 0
        END AS aov,
        (SELECT string_agg(DISTINCT cashier, ', ') FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS cashier,
        (SELECT string_agg(DISTINCT shift, ', ') FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS shift,
        (SELECT mode() WITHIN GROUP (ORDER BY source) FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS source,
        NULL::text AS source_ref,
        (SELECT string_agg(DISTINCT notes, '; ') FROM finance.fin_pos_receipts r2 WHERE r2.date = r.date AND r2.outlet_id = r.outlet_id) AS notes,
        MAX(r.recorded_at) AS recorded_at,
        MAX(r.recorded_by) AS recorded_by,
        MAX(r.created_at) AS created_at,
        MAX(r.updated_at) AS updated_at
      FROM finance.fin_pos_receipts r
      LEFT JOIN LATERAL (
        SELECT key AS method_id, value::integer AS total
        FROM jsonb_each_text(r.payment_breakdown)
      ) pm ON true
      GROUP BY r.date, r.brand_id, r.brand_name, r.outlet_id, r.outlet_name;
    `);
  }
  ```

  Note: the `aov_numerator` column in the INSERT is a placeholder; it should be removed. Instead, keep a `receipt_id` derived from `financeDayId` or stable legacy string. Fix the INSERT to match the table columns exactly. If the legacy migration is tricky, do it in a separate one-time script and run it manually.

- [ ] **Step 4: Run drizzle generate and local migration**

  ```bash
  cd ykp-erp
  npm run db:generate
  npm run db:migrate
  ```

  Expected: migration succeeds, `finance.fin_pos_receipts` and `finance.fin_pos_daily_view` exist.

- [ ] **Step 5: Commit**

  ```bash
  git add ykp-erp/packages/schema/src/finance.ts ykp-erp/packages/schema/src/migrate.ts ykp-erp/drizzle/
  git commit -m "feat(schema): fin_pos_receipts source of truth + daily view"
  ```

---

### Task 2: Receipt ID Generator

**Files:**
- Modify: `ykp-erp/packages/engine/src/id-gen.ts`

- [ ] **Step 1: Add `receiptId` generator**

  ```ts
  /**
   * Generate a stable receipt ID.
   * Format: RCP-YYYYMMDD-OL-NNNN
   */
  export function receiptId(date: string, outletId: string, seq: number): string {
    const d = date.replace(/-/g, "");
    const seqStr = seq.toString().padStart(4, "0");
    return `RCP-${d}-${outletId}-${seqStr}`;
  }
  ```

- [ ] **Step 2: Export from package index if needed**

  Ensure `receiptId` is exported from `packages/engine/src/index.ts` or wherever package exports live.

- [ ] **Step 3: Add test**

  Create `ykp-erp/packages/engine/src/id-gen.test.ts` if not exists, or add to existing test file:

  ```ts
  import { describe, it, expect } from "vitest";
  import { receiptId } from "./id-gen";

  describe("receiptId", () => {
    it("formats stable receipt id", () => {
      expect(receiptId("2026-07-18", "OL-001", 1)).toBe("RCP-20260718-OL-001-0001");
    });
  });
  ```

  Run: `npm test -- packages/engine/src/id-gen.test.ts`

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-erp/packages/engine/src/id-gen.ts ykp-erp/packages/engine/src/id-gen.test.ts
  git commit -m "feat(engine): receiptId generator"
  ```

---

### Task 3: Moka CSV Parser — Per Receipt

**Files:**
- Modify: `ykp-erp/packages/engine/src/moka-importer.ts`
- Modify: `ykp-erp/packages/engine/src/moka-importer.test.ts` (if exists) or create

- [ ] **Step 1: Change return type to receipt list**

  Current type likely aggregates by `(date, outlet)`. Change `MokaParsedRow` to represent one receipt:

  ```ts
  export interface MokaParsedReceipt {
    date: string; // YYYY-MM-DD
    outletName: string;
    outletId?: string;
    brandId?: string;
    brandName?: string;
    receiptNumber: string;
    transactionTime?: string;
    grossSales: number;
    discount: number;
    refund: number;
    voidAmount: number;
    tax: number;
    serviceCharge: number;
    netSales: number;
    paymentMethod: string; // e.g. "Cash"
    paymentAmount: number;
    paymentBreakdown: Record<string, number>;
    transactionCount: number;
    cashier?: string;
    shift?: string;
    sourceRef?: string;
    notes?: string;
  }

  export interface MokaParseResult {
    rows: MokaParsedReceipt[];
    errors: { row: number; field: string; reason: string }[];
  }
  ```

- [ ] **Step 2: Update `parseMokaCsv` body**

  Keep CSV parsing but emit one row per receipt. If the CSV already has one row per receipt, preserve it. If the CSV has a summary format, return errors telling user to export per-receipt format.

  Pseudocode to implement:

  ```ts
  export function parseMokaCsv(csvText: string): MokaParseResult {
    const rows = parseCsvRows(csvText); // existing helper
    const result: MokaParsedReceipt[] = [];
    const errors: MokaParseResult["errors"] = [];

    for (let i = 1; i < rows.length; i++) { // skip header
      const raw = rows[i];
      const parsed = parseMokaReceiptRow(raw, i);
      if (parsed.errors.length) {
        errors.push(...parsed.errors);
      } else if (parsed.receipt) {
        result.push(parsed.receipt);
      }
    }

    return { rows: result, errors };
  }
  ```

  Implement `parseMokaReceiptRow` to read columns: date, outlet, receipt number, gross, discount, refund, void, tax, service, payment method, amount, cashier, shift. Map payment breakdown to `{ method: amount }`. Set `transactionCount` to 1 unless the row explicitly says it is a pre-aggregate.

- [ ] **Step 3: Update tests**

  Replace aggregate tests with receipt tests:

  ```ts
  it("parses per-receipt Moka CSV", () => {
    const csv = `date,outlet,receipt_number,gross_sales,discount,refund,void,tax,service,payment_method,payment_amount,cashier,shift
2026-07-18,Outlet A,INV-001,100000,0,0,0,10000,0,Cash,110000,Alice,Morning`;
    const res = parseMokaCsv(csv);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].netSales).toBe(100000);
    expect(res.rows[0].paymentBreakdown).toEqual({ Cash: 110000 });
  });
  ```

  Run: `npm test -- packages/engine/src/moka-importer.test.ts`

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-erp/packages/engine/src/moka-importer.ts ykp-erp/packages/engine/src/moka-importer.test.ts
  git commit -m "feat(engine): parse Moka CSV per receipt"
  ```

---

### Task 4: Update POS Import API

**Files:**
- Modify: `ykp-erp/apps/finance/src/app/api/fin/pos/import/route.ts`

- [ ] **Step 1: Replace daily upsert with receipt insert**

  After parsing, resolve outlet IDs from master by name, then insert each receipt row into `fin_pos_receipts`. Compute `net_sales` per receipt. Detect duplicate by `(date, outlet_id, receipt_number)`.

  ```ts
  import { finPosReceipts } from "@ykp/schema";
  import { receiptId, format } from "@ykp/engine";
  import { eq, and } from "drizzle-orm";
  import { getFinanceDb, getMasterDb } from "@finance/lib/server/db";
  import { assertOutlet } from "@finance/lib/server/refs";
  import { logFinanceAudit } from "@finance/lib/server/audit";
  import { parseMokaCsv, type MokaParsedReceipt } from "@ykp/engine";
  ```

  In the transaction:

  ```ts
  for (const row of resolved) {
    const key = `${row.date}|${row.outletId}|${row.receiptNumber}`;
    const existing = await tx
      .select({ receiptId: finPosReceipts.receiptId })
      .from(finPosReceipts)
      .where(and(
        eq(finPosReceipts.date, new Date(row.date)),
        eq(finPosReceipts.outletId, row.outletId),
        eq(finPosReceipts.receiptNumber, row.receiptNumber)
      ));
    if (existing.length > 0) {
      errors.push({ row: resolved.indexOf(row) + 1, reason: `duplicate receipt ${row.receiptNumber}` });
      continue;
    }

    const seq = await getNextReceiptSeq(tx, row.date, row.outletId);
    const id = receiptId(row.date, row.outletId, seq);

    const netSales = row.grossSales - row.discount - row.refund - row.voidAmount;

    await tx.insert(finPosReceipts).values({
      receiptId: id,
      date: new Date(row.date),
      brandId: row.brandId,
      brandName: row.brandName,
      outletId: row.outletId,
      outletName: row.outletName,
      receiptNumber: row.receiptNumber,
      transactionTime: row.transactionTime,
      grossSales: row.grossSales,
      discount: row.discount,
      refund: row.refund,
      void: row.voidAmount,
      tax: row.tax,
      serviceCharge: row.serviceCharge,
      netSales,
      paymentMethodId: Object.keys(row.paymentBreakdown)[0] ?? null,
      paymentAmount: Object.values(row.paymentBreakdown)[0] ?? 0,
      paymentBreakdown: row.paymentBreakdown,
      transactionCount: row.transactionCount,
      cashier: row.cashier,
      shift: row.shift,
      source: "moka",
      sourceRef: row.sourceRef,
      notes: row.notes,
      recordedBy: user.id,
    });
    imported.push({ receipt_id: id, date: row.date, outlet_id: row.outletId });
  }
  ```

  Implement `getNextReceiptSeq` by counting existing receipts for the date+outlet inside the transaction.

- [ ] **Step 2: Update audit log**

  Log bulk import:

  ```ts
  await logFinanceAudit(getFinanceDb(), {
    actor: user.id,
    action: "fin_pos_receipts:import",
    entity: "fin_pos_receipts",
    entityId: "bulk",
    after: { rows_imported: imported.length, errors: errors.length },
  });
  ```

- [ ] **Step 3: Test locally**

  Import a CSV with 3 receipts, verify 3 rows in `fin_pos_receipts`, verify `fin_pos_daily_view` shows the aggregate.

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/app/api/fin/pos/import/route.ts
  git commit -m "feat(finance): import Moka CSV as individual receipts"
  ```

---

### Task 5: New Receipt API Routes

**Files:**
- Create: `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/route.ts`
- Create: `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/[id]/route.ts`
- Create: `ykp-erp/apps/finance/src/app/api/fin/pos/receipts/[id]/verify/route.ts`

- [ ] **Step 1: List + create receipts**

  `route.ts`:

  ```ts
  import { handler, ok, fail } from "@finance/lib/server/http";
  import { getFinanceDb } from "@finance/lib/server/db";
  import { finPosReceipts } from "@ykp/schema";
  import { and, eq, gte, lte, desc } from "drizzle-orm";
  import { Role } from "@ykp/config";
  import { requireRole } from "@ykp/auth";
  import { FinPosReceiptCreateSchema } from "@finance/lib/schemas";
  import { receiptId } from "@ykp/engine";
  import { logFinanceAudit } from "@finance/lib/server/audit";

  export const GET = handler(async (req) => {
    const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER]);
    const search = new URL(req.url).searchParams;
    const date = search.get("date");
    const outletId = search.get("outlet_id");
    const db = getFinanceDb();
    const where = [];
    if (date) where.push(eq(finPosReceipts.date, new Date(date)));
    if (outletId) where.push(eq(finPosReceipts.outletId, outletId));
    const rows = await db.select().from(finPosReceipts).where(where.length ? and(...where) : undefined).orderBy(desc(finPosReceipts.date));
    return ok(rows);
  });

  export const POST = handler(async (req) => {
    const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.OUTLET_MANAGER]);
    const body = await req.json();
    const parsed = FinPosReceiptCreateSchema.safeParse(body);
    if (!parsed.success) return fail("validation_error", "Invalid receipt payload", parsed.error.flatten());
    const data = parsed.data;
    const netSales = data.gross_sales - data.discount - data.refund - data.void_amount;
    const db = getFinanceDb();
    const existing = await db.select({ receiptId: finPosReceipts.receiptId }).from(finPosReceipts).where(
      and(eq(finPosReceipts.date, new Date(data.date)), eq(finPosReceipts.outletId, data.outlet_id), eq(finPosReceipts.receiptNumber, data.receipt_number))
    );
    if (existing.length > 0) return fail("duplicate", "Receipt already exists for this date, outlet, and receipt number", { receipt_id: existing[0].receiptId });
    const seq = await getNextReceiptSeq(db, data.date, data.outlet_id);
    const id = receiptId(data.date, data.outlet_id, seq);
    const [inserted] = await db.insert(finPosReceipts).values({
      receiptId: id,
      date: new Date(data.date),
      brandId: data.brand_id,
      brandName: data.brand_name,
      outletId: data.outlet_id,
      outletName: data.outlet_name,
      receiptNumber: data.receipt_number,
      transactionTime: data.transaction_time,
      grossSales: data.gross_sales,
      discount: data.discount ?? 0,
      refund: data.refund ?? 0,
      void: data.void_amount ?? 0,
      tax: data.tax ?? 0,
      serviceCharge: data.service_charge ?? 0,
      netSales,
      paymentMethodId: data.payment_method_id,
      paymentAmount: data.payment_amount,
      paymentBreakdown: data.payment_breakdown ?? { [data.payment_method_id]: data.payment_amount },
      transactionCount: data.transaction_count ?? 1,
      cashier: data.cashier,
      shift: data.shift,
      source: data.source ?? "manual",
      sourceRef: data.source_ref,
      notes: data.notes,
      photoUrl: data.photo_url,
      photoPath: data.photo_path,
      recordedBy: user.id,
    }).returning();
    await logFinanceAudit(db, { actor: user.id, action: "fin_pos_receipt:created", entity: "fin_pos_receipts", entityId: inserted.receiptId, after: inserted });
    return ok(inserted, 201);
  });

  async function getNextReceiptSeq(db: FinanceDb, date: string, outletId: string): Promise<number> {
    const rows = await db.select({ receiptId: finPosReceipts.receiptId }).from(finPosReceipts).where(
      and(eq(finPosReceipts.date, new Date(date)), eq(finPosReceipts.outletId, outletId))
    );
    return rows.length + 1;
  }
  ```

- [ ] **Step 2: Single receipt detail/delete**

  `[id]/route.ts`:

  ```ts
  export const GET = handler(async (req, { params }: { params: { id: string } }) => {
    await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER, Role.OUTLET_MANAGER, Role.VIEWER]);
    const db = getFinanceDb();
    const row = await db.select().from(finPosReceipts).where(eq(finPosReceipts.receiptId, params.id)).limit(1);
    if (!row.length) return fail("not_found", "Receipt not found");
    return ok(row[0]);
  });

  export const DELETE = handler(async (req, { params }) => {
    const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
    const db = getFinanceDb();
    const row = await db.select().from(finPosReceipts).where(eq(finPosReceipts.receiptId, params.id)).limit(1);
    if (!row.length) return fail("not_found", "Receipt not found");
    await db.delete(finPosReceipts).where(eq(finPosReceipts.receiptId, params.id));
    await logFinanceAudit(db, { actor: user.id, action: "fin_pos_receipt:deleted", entity: "fin_pos_receipts", entityId: params.id, before: row[0] });
    return ok({ receipt_id: params.id });
  });
  ```

- [ ] **Step 3: Verify receipt**

  `[id]/verify/route.ts`:

  ```ts
  export const POST = handler(async (req, { params }) => {
    const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER]);
    const db = getFinanceDb();
    const [updated] = await db.update(finPosReceipts).set({
      verifiedBy: user.id,
      verifiedAt: new Date(),
    }).where(eq(finPosReceipts.receiptId, params.id)).returning();
    if (!updated) return fail("not_found", "Receipt not found");
    await logFinanceAudit(db, { actor: user.id, action: "fin_pos_receipt:verified", entity: "fin_pos_receipts", entityId: params.id, after: updated });
    return ok(updated);
  });
  ```

- [ ] **Step 4: Add `FinPosReceiptCreateSchema` to `ykp-erp/apps/finance/src/lib/schemas.ts`**

  ```ts
  export const FinPosReceiptCreateSchema = z.object({
    date: z.string().date(),
    brand_id: z.string().min(1),
    brand_name: z.string().min(1),
    outlet_id: z.string().min(1),
    outlet_name: z.string().min(1),
    receipt_number: z.string().min(1),
    transaction_time: z.string().optional(),
    gross_sales: z.number().int().min(0),
    discount: z.number().int().min(0).optional(),
    refund: z.number().int().min(0).optional(),
    void_amount: z.number().int().min(0).optional(),
    tax: z.number().int().min(0).optional(),
    service_charge: z.number().int().min(0).optional(),
    payment_method_id: z.string().min(1),
    payment_amount: z.number().int().min(0),
    payment_breakdown: z.record(z.string(), z.number().int()).optional(),
    transaction_count: z.number().int().min(1).optional(),
    cashier: z.string().optional(),
    shift: z.string().optional(),
    source: z.enum(["moka", "manual"]).optional(),
    source_ref: z.string().optional(),
    notes: z.string().optional(),
    photo_url: z.string().optional(),
    photo_path: z.string().optional(),
  });
  ```

- [ ] **Step 5: Test API endpoints**

  Use Postman or curl to POST a receipt, GET list, GET detail, POST verify, DELETE.
  Verify `fin_pos_daily_view` updates.

- [ ] **Step 6: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/app/api/fin/pos/receipts/ ykp-erp/apps/finance/src/lib/schemas.ts
  git commit -m "feat(finance): individual receipt API routes"
  ```

---

### Task 6: Photo Upload API

**Files:**
- Create: `ykp-erp/apps/finance/src/lib/supabase.ts`
- Create: `ykp-erp/apps/finance/src/app/api/fin/pos/upload/route.ts`

- [ ] **Step 1: Add Supabase client**

  `ykp-erp/apps/finance/src/lib/supabase.ts`:

  ```ts
  import { createClient } from "@supabase/supabase-js";

  export function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase credentials");
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  ```

  Add to `ykp-erp/apps/finance/.env.example`:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=
  SUPABASE_SERVICE_ROLE_KEY=
  ```

- [ ] **Step 2: Create upload route**

  `route.ts`:

  ```ts
  import { handler, ok, fail } from "@finance/lib/server/http";
  import { requireRole } from "@ykp/auth";
  import { Role } from "@ykp/config";
  import { getSupabaseAdmin } from "@finance/lib/supabase";
  import { BUCKET_POS_RECEIPTS } from "@ykp/config";
  import { randomUUID } from "crypto";

  const MAX_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  export const POST = handler(async (req) => {
    await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.OUTLET_MANAGER]);
    const form = await req.formData();
    const file = form.get("file");
    const outletId = form.get("outlet_id")?.toString();
    const date = form.get("date")?.toString();
    if (!file || !(file instanceof File)) return fail("validation_error", "Missing file");
    if (file.size > MAX_SIZE) return fail("validation_error", "File too large");
    if (!ALLOWED_TYPES.includes(file.type)) return fail("validation_error", "Invalid file type");
    if (!outletId || !date) return fail("validation_error", "Missing outlet_id or date");

    const ext = file.type.split("/")[1];
    const path = `pos-receipts/${outletId}/${date}/${randomUUID()}.${ext}`;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(BUCKET_POS_RECEIPTS).upload(path, file, { contentType: file.type });
    if (error) return fail("storage_error", error.message);
    const { data: publicData } = supabase.storage.from(BUCKET_POS_RECEIPTS).getPublicUrl(path);
    return ok({ publicUrl: publicData.publicUrl, path });
  });
  ```

- [ ] **Step 3: Add bucket constant**

  In `ykp-erp/packages/config/src/index.ts`:

  ```ts
  export const BUCKET_POS_RECEIPTS = "pos-receipts";
  ```

  Also ensure `@supabase/supabase-js` is installed in the finance app workspace; if not, run:

  ```bash
  cd ykp-erp/apps/finance
  npm install @supabase/supabase-js
  ```

- [ ] **Step 4: Test upload**

  POST a JPEG to `/api/fin/pos/upload` with `file`, `outlet_id`, `date`. Expect `{ publicUrl, path }`.

- [ ] **Step 5: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/lib/supabase.ts ykp-erp/apps/finance/src/app/api/fin/pos/upload/route.ts ykp-erp/packages/config/src/index.ts ykp-erp/apps/finance/package.json ykp-erp/apps/finance/.env.example
  git commit -m "feat(finance): POS receipt photo upload to Supabase Storage"
  ```

---

### Task 7: Update POS List API to Read View

**Files:**
- Modify: `ykp-erp/apps/finance/src/app/api/fin/pos/route.ts`

- [ ] **Step 1: Switch GET from `finPosDaily` table to `finPosDailyView`**

  Replace `from(finPosDaily)` with `from(finPosDailyView)`. Keep response shape identical.

  ```ts
  import { finPosDailyView } from "@ykp/schema";
  // ...
  const rows = await db.select().from(finPosDailyView).where(...).orderBy(desc(finPosDailyView.date)).limit(limit);
  ```

- [ ] **Step 2: Remove or redirect POST**

  The POST that created daily aggregate rows should be removed or return a 410/redirect to `/api/fin/pos/receipts`. Prefer redirect to avoid breaking any callers:

  ```ts
  export const POST = handler(async () => {
    return fail("gone", "Use POST /api/fin/pos/receipts to create individual receipts");
  });
  ```

- [ ] **Step 3: Test backwards compatibility**

  GET `/api/fin/pos?date_from=2026-07-01&date_to=2026-07-18` must still return the same JSON shape as before, now populated from the view.

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/app/api/fin/pos/route.ts
  git commit -m "feat(finance): POS list reads from fin_pos_daily_view"
  ```

---

### Task 8: Frontend Types + Service + Queries

**Files:**
- Modify: `ykp-erp/apps/finance/src/features/finance/api/types.ts`
- Modify: `ykp-erp/apps/finance/src/features/finance/api/service.ts`
- Modify: `ykp-erp/apps/finance/src/features/finance/api/queries.ts`
- Modify: `ykp-erp/apps/finance/src/features/finance/api/mutations.ts`

- [ ] **Step 1: Add receipt types**

  `types.ts`:

  ```ts
  export interface PosReceipt {
    receiptId: string;
    date: string;
    brandId: string;
    brandName: string;
    outletId: string;
    outletName: string;
    receiptNumber: string;
    transactionTime?: string;
    grossSales: number;
    netSales: number;
    discount: number;
    refund: number;
    void: number;
    tax: number;
    serviceCharge: number;
    paymentMethodId: string;
    paymentAmount: number;
    paymentBreakdown: Record<string, number>;
    transactionCount: number;
    cashier?: string;
    shift?: string;
    source: "moka" | "manual";
    sourceRef?: string;
    notes?: string;
    photoUrl?: string;
    photoPath?: string;
    verifiedBy?: string;
    verifiedAt?: string;
    recordedBy?: string;
    recordedAt: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface CreatePosReceiptBody {
    date: string;
    brand_id: string;
    brand_name: string;
    outlet_id: string;
    outlet_name: string;
    receipt_number: string;
    transaction_time?: string;
    gross_sales: number;
    discount?: number;
    refund?: number;
    void_amount?: number;
    tax?: number;
    service_charge?: number;
    payment_method_id: string;
    payment_amount: number;
    payment_breakdown?: Record<string, number>;
    transaction_count?: number;
    cashier?: string;
    shift?: string;
    source?: "moka" | "manual";
    source_ref?: string;
    notes?: string;
    photo_url?: string;
    photo_path?: string;
  }
  ```

- [ ] **Step 2: Add service methods**

  `service.ts`:

  ```ts
  listReceipts(params: URLSearchParams): Promise<PosReceipt[]> {
    return this.fetch(`/api/fin/pos/receipts?${params.toString()}`);
  }
  createReceipt(body: CreatePosReceiptBody): Promise<PosReceipt> {
    return this.fetch("/api/fin/pos/receipts", { method: "POST", body: JSON.stringify(body) });
  }
  verifyReceipt(id: string): Promise<PosReceipt> {
    return this.fetch(`/api/fin/pos/receipts/${id}/verify`, { method: "POST" });
  }
  deleteReceipt(id: string): Promise<{ receipt_id: string }> {
    return this.fetch(`/api/fin/pos/receipts/${id}`, { method: "DELETE" });
  }
  uploadPhoto(formData: FormData): Promise<{ publicUrl: string; path: string }> {
    return this.fetch("/api/fin/pos/upload", { method: "POST", body: formData });
  }
  ```

- [ ] **Step 3: Add query hooks**

  `queries.ts`:

  ```ts
  export function usePosReceipts(params: URLSearchParams) {
    return useQuery<PosReceipt[]>({
      queryKey: ["fin", "pos-receipts", params.toString()],
      queryFn: () => finService.listReceipts(params) as Promise<PosReceipt[]>,
      staleTime: STALE,
    });
  }
  ```

- [ ] **Step 4: Add mutation hooks**

  `mutations.ts`:

  ```ts
  export function useCreatePosReceipt() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body: CreatePosReceiptBody) => finService.createReceipt(body),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["fin", "pos-receipts"] });
        qc.invalidateQueries({ queryKey: ["fin", "pos"] });
      },
    });
  }
  export function useVerifyPosReceipt() { ... }
  export function useDeletePosReceipt() { ... }
  export function useUploadPosPhoto() { ... }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/features/finance/api/
  git commit -m "feat(finance): POS receipt API client hooks"
  ```

---

### Task 9: Photo Upload Component

**Files:**
- Create: `ykp-erp/apps/finance/src/features/finance/components/pos-photo-upload.tsx`

- [ ] **Step 1: Implement upload component**

  ```tsx
  "use client";
  import * as React from "react";
  import { Button } from "@ykp/ui";
  import { useUploadPosPhoto } from "../api/mutations";
  import { ImagePlus, X } from "lucide-react";

  export interface PosPhotoUploadProps {
    outletId: string;
    date: string;
    value?: { url: string; path: string };
    onChange: (value?: { url: string; path: string }) => void;
  }

  export function PosPhotoUpload({ outletId, date, value, onChange }: PosPhotoUploadProps) {
    const upload = useUploadPosPhoto();
    const inputRef = React.useRef<HTMLInputElement>(null);

    const onFile = async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("outlet_id", outletId);
      fd.append("date", date);
      const res = await upload.mutateAsync(fd);
      onChange({ url: res.publicUrl, path: res.path });
    };

    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">Foto Nota</label>
        {value ? (
          <div className="relative w-48">
            <img src={value.url} alt="receipt" className="rounded-md border object-cover" />
            <button onClick={() => onChange(undefined)} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            <ImagePlus className="mr-2 h-4 w-4" /> {upload.isPending ? "Uploading..." : "Upload Foto"}
          </Button>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/features/finance/components/pos-photo-upload.tsx
  git commit -m "feat(finance): POS receipt photo upload component"
  ```

---

### Task 10: Receipt Form Dialog

**Files:**
- Create: `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-form.tsx`
- Modify: `ykp-erp/apps/finance/src/features/finance/components/pos-form-dialog.tsx` (remove or repurpose)

- [ ] **Step 1: Create receipt form component**

  Use the existing form fields plus receipt number, payment method dropdown, amount, and photo upload. Use `@finance/features/finance/api/mutations` for create.

  Fields:
  - Tanggal
  - Outlet (select from `useOutlets`)
  - Nomor Nota (receipt_number)
  - Waktu Transaksi (optional)
  - Gross Sales
  - Discount, Refund, Void, Tax, Service Charge
  - Payment Method (select from `usePaymentMethods`)
  - Payment Amount
  - Jumlah Transaksi (default 1)
  - Kasir, Shift
  - Catatan
  - Foto Nota (`PosPhotoUpload`)

  On submit, compute `net_sales` and `payment_breakdown` and call `createReceipt`.

- [ ] **Step 2: Replace `PosFormDialog` usage**

  In `pos/page.tsx`, replace `<PosFormDialog />` with `<PosReceiptFormDialog />`.

- [ ] **Step 3: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/features/finance/components/pos-receipt-form.tsx ykp-erp/apps/finance/src/features/finance/components/pos-form-dialog.tsx ykp-erp/apps/finance/src/app/(dashboard)/pos/page.tsx
  git commit -m "feat(finance): manual POS receipt form with photo"
  ```

---

### Task 11: Receipt Drill-Down Table

**Files:**
- Create: `ykp-erp/apps/finance/src/features/finance/components/pos-receipt-table.tsx`
- Modify: `ykp-erp/apps/finance/src/features/finance/components/pos-table.tsx`
- Modify: `ykp-erp/apps/finance/src/app/(dashboard)/pos/page.tsx`

- [ ] **Step 1: Create receipt table**

  Show columns: receipt number, time, gross, net, payment method, amount, cashier, shift, source, verified badge, photo thumbnail.

  Add actions: Verify, Delete (for OWNER/FINANCE_ADMIN), View photo (modal).

- [ ] **Step 2: Make daily table expandable**

  In `PosTable`, add a row expansion that renders `PosReceiptTable` for that `(date, outlet)`.

  Use TanStack Table `getRowCanExpand` + `renderSubComponent`.

- [ ] **Step 3: Update POS page**

  Pass `params` to `PosTable` and ensure expansion works.

- [ ] **Step 4: Commit**

  ```bash
  git add ykp-erp/apps/finance/src/features/finance/components/pos-receipt-table.tsx ykp-erp/apps/finance/src/features/finance/components/pos-table.tsx ykp-erp/apps/finance/src/app/(dashboard)/pos/page.tsx
  git commit -m "feat(finance): drill-down POS receipts per day/outlet"
  ```

---

### Task 12: Typecheck + Tests + Clean-up

**Files:**
- All modified files

- [ ] **Step 1: Run typecheck**

  ```bash
  cd ykp-erp
  npm run typecheck
  ```

  Fix all errors. Common issues: `finPosDaily` references still used, missing `FinanceDb` type import, `PosReceipt` type mismatch.

- [ ] **Step 2: Run tests**

  ```bash
  cd ykp-erp
  npm test
  ```

  Fix failing tests. Existing POS tests may be expecting the old aggregate behavior; update them to receipt-level assertions.

- [ ] **Step 3: Remove old `finPosDaily` references**

  Search for `finPosDaily` imports across the monorepo. Replace with `finPosDailyView` where reads are needed, and with receipt APIs where writes are needed. Do not delete the `finPosDaily` type export yet if it would break Hermez; use `finPosDailyView` as a drop-in.

- [ ] **Step 4: Commit**

  ```bash
  git commit -m "chore(finance): typecheck clean + receipt migration complete"
  ```

---

## Spec Coverage Self-Review

| Spec Requirement | Plan Task |
|---|---|
| `fin_pos_receipts` table | Task 1 |
| `fin_pos_daily` view | Task 1 |
| Legacy data migration | Task 1 |
| Receipt ID generator | Task 2 |
| Moka CSV per receipt | Task 3 |
| Import API inserts receipts | Task 4 |
| Receipt CRUD + verify API | Task 5 |
| Photo upload to Supabase | Task 6, 9 |
| POS list reads view | Task 7 |
| Frontend types/service/queries | Task 8 |
| Manual receipt form with photo | Task 10 |
| Drill-down table | Task 11 |
| Typecheck + tests | Task 12 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-18-finance-pos-individual-receipt-plan.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
