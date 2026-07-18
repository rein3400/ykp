/**
 * POST /api/fin/export/pdf — real PDF export using a hand-rolled PDF 1.4
 * writer. No @react-pdf dependency is required: we generate a multi-page
 * text-only PDF (Helvetica core font, ASCII-safe transliteration) from
 * scratch. The output is a data URL so the client can stream it to the
 * user's downloads without needing a temp file on disk (serverless-safe).
 *
 * The PDF object layout follows PDF 1.4 §7.3 (File Structure) and §7.5
 * (File Body). Each stream is uncompressed for the smallest code path;
 * size is dominated by the text content itself.
 */
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { Role } from "@ykp/config";
import { requireRole, can } from "@ykp/auth";
import {
  finPosDailyView,
  finSupplierCost,
  finPettyCash,
  finExpense,
  finClosingCash,
  finDailySummary,
} from "@ykp/schema";
import { getFinanceDb } from "@finance/lib/server/db";
import { handler, ok, fail } from "@finance/lib/server/http";
import { FinExportRequestSchema } from "@finance/lib/schemas";
import { todayWib } from "@ykp/engine";

/** Transliterate to WinAnsi-ish ASCII so Helvetica's single-byte encoder
 *  (PDF 1.4 default) does not choke on Indonesian diacritics. The text
 *  remains readable; numeric / currency formatting is unaffected. */
function asciiSafe(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfEscape(s: string): string {
  return asciiSafe(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Compose a PDF document. `title` is centered at the top of page 1;
 * `headers` and `rows` form a fixed-width table wrapped across pages.
 * Page size is A4 (595x842 pt). Margins are 36pt.
 */
function buildPdf(opts: { title: string; headers: string[]; rows: string[][] }): Buffer {
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 36;
  const ROW_H = 14;
  const TITLE_H = 28;

  const usableW = PAGE_W - MARGIN * 2;
  const colW = Math.max(40, Math.floor(usableW / Math.max(1, opts.headers.length)));

  // Split rows across pages; reserve rows for the title on page 1.
  const rowsPerFirstPage = Math.floor((PAGE_H - MARGIN * 2 - TITLE_H) / ROW_H);
  const rowsPerPage = Math.floor((PAGE_H - MARGIN * 2) / ROW_H);
  const pages: string[][] = [];
  let cursor = 0;
  // page 1 (title + headers + body)
  const firstBody = opts.rows.slice(cursor, cursor + Math.max(0, rowsPerFirstPage - 1));
  pages.push(["__TITLE__", ...opts.headers, ...firstBody.flat()]);
  cursor += firstBody.length;
  while (cursor < opts.rows.length) {
    const slice = opts.rows.slice(cursor, cursor + rowsPerPage - 1);
    pages.push([...opts.headers, ...slice.flat()]);
    cursor += slice.length;
  }
  if (pages.length === 0) pages.push(["__TITLE__", ...opts.headers]);

  // Build content streams per page.
  const contentStreams: Buffer[] = pages.map((pageRows) => {
    let body = "BT\n/F1 9 Tf\n";
    const leading = ROW_H;
    body += `${leading} TL\n`;
    // First line is the title in 14pt if present.
    let y = PAGE_H - MARGIN - 10;
    let first = true;
    for (const cell of pageRows) {
      if (first && cell === "__TITLE__") {
        body += "/F1 14 Tf\n";
        const titleWidth = asciiSafe(opts.title).length * 7;
        const tx = Math.max(MARGIN, (PAGE_W - titleWidth) / 2);
        body += `1 0 0 1 ${tx} ${y} Tm\n(${pdfEscape(opts.title)}) Tj\n`;
        body += "/F1 9 Tf\n";
        y -= TITLE_H;
        first = false;
        continue;
      }
      first = false;
      const x = MARGIN;
      // Wrap each line as Tm (absolute move) + Tj. Left-truncate to fit.
      const maxChars = Math.max(4, Math.floor(colW / 4.5));
      let text = asciiSafe(cell);
      if (text.length > maxChars) text = text.slice(0, maxChars - 1) + "…";
      body += `1 0 0 1 ${x} ${y} Tm\n(${pdfEscape(text)}) Tj\n`;
      y -= ROW_H;
    }
    body += "ET\n";
    return Buffer.from(body, "latin1");
  });

  // Assemble PDF objects.
  const objects: string[] = [];
  // 1: Catalog; 2: Pages; 3: Font
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageRefs: number[] = [];
  let nextObjNum = 4;
  for (let i = 0; i < contentStreams.length; i++) {
    const contentObj = nextObjNum++;
    const pageObj = nextObjNum++;
    pageRefs.push(pageObj);
    objects.push(`<< /Length ${contentStreams[i].length} >>\nstream\n${contentStreams[i].toString("latin1")}endstream`);
    // We'll fix the page object text after we know the content obj num.
  }
  // Rebuild with proper page objects. Simpler approach: rebuild the
  // whole list now that we know all object numbers.
  const contentObjNums: number[] = [];
  objects.length = 0;
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Count 0 /Kids [] >>"); // placeholder
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const usedFontObj = 3;
  for (const cs of contentStreams) {
    const cnum = nextObjNum++;
    contentObjNums.push(cnum);
    objects.push(`<< /Length ${cs.length} >>\nstream\n${cs.toString("latin1")}endstream`);
  }
  for (let i = 0; i < pageRefs.length; i++) {
    const pnum = nextObjNum++;
    pageRefs[i] = pnum;
    const cnum = contentObjNums[i];
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${cnum} 0 R /Resources << /Font << /F1 ${usedFontObj} 0 R >> >> >>`);
  }
  // Now write the Kids array back into object 2.
  objects[1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map((n) => `${n} 0 R`).join(" ")}] >>`;

  // Serialize with header + xref + trailer.
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function toDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export const POST = handler(async (req: NextRequest) => {
  const user = await requireRole([Role.FINANCE_ADMIN, Role.SUPER_ADMIN, Role.OWNER, Role.BRAND_MANAGER]);
  if (!can(user.role, "report", "export")) return fail("forbidden", "Role cannot export PDF");

  const body = await req.json();
  const parsed = FinExportRequestSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid export request", parsed.error.flatten());

  const { report, date_from, date_to, filters } = parsed.data;
  const db = getFinanceDb();
  const filters_ = filters ?? {};

  let headers: string[] = [];
  let rows: string[][] = [];

  switch (report) {
    case "pos_daily": {
      const conds = [gte(finPosDailyView.date, new Date(date_from)), lte(finPosDailyView.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finPosDailyView.outletId, filters_.outlet_id));
      if (filters_.brand_id) conds.push(eq(finPosDailyView.brandId, filters_.brand_id));
      const result = await db.select().from(finPosDailyView).where(and(...conds)).orderBy(asc(finPosDailyView.date));
      headers = ["date", "outlet", "gross", "net", "discount", "refund", "txn", "aov"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date ?? ""),
        r.outletName ?? "",
        String(r.grossSales ?? 0),
        String(r.netSales ?? 0),
        String(r.discount ?? 0),
        String(r.refund ?? 0),
        String(r.transactionCount ?? 0),
        String(r.aov ?? 0),
      ]);
      break;
    }
    case "supplier_cost": {
      const conds = [gte(finSupplierCost.date, new Date(date_from)), lte(finSupplierCost.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finSupplierCost.outletId, filters_.outlet_id));
      if (filters_.supplier_id) conds.push(eq(finSupplierCost.supplierId, filters_.supplier_id));
      if (filters_.status) conds.push(eq(finSupplierCost.paymentStatus, filters_.status as never));
      const result = await db.select().from(finSupplierCost).where(and(...conds)).orderBy(asc(finSupplierCost.date));
      headers = ["date", "supplier", "amount", "paid", "unpaid", "status"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        r.supplierName,
        String(r.amount),
        String(r.paidAmount),
        String(r.unpaidAmount),
        r.paymentStatus,
      ]);
      break;
    }
    case "petty_cash": {
      const conds = [gte(finPettyCash.date, new Date(date_from)), lte(finPettyCash.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finPettyCash.outletId, filters_.outlet_id));
      const result = await db.select().from(finPettyCash).where(and(...conds)).orderBy(asc(finPettyCash.date));
      headers = ["date", "outlet", "type", "amount", "urgent", "status"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        r.outletName,
        r.type,
        String(r.amount),
        r.urgentFlag ? "Y" : "N",
        r.approvalStatus,
      ]);
      break;
    }
    case "expense": {
      const conds = [gte(finExpense.date, new Date(date_from)), lte(finExpense.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finExpense.outletId, filters_.outlet_id));
      const result = await db.select().from(finExpense).where(and(...conds)).orderBy(asc(finExpense.date));
      headers = ["date", "outlet", "amount", "method", "status"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        r.outletName,
        String(r.amount),
        r.paymentMethodId,
        r.approvalStatus,
      ]);
      break;
    }
    case "closing_cash": {
      const conds = [gte(finClosingCash.date, new Date(date_from)), lte(finClosingCash.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finClosingCash.outletId, filters_.outlet_id));
      const result = await db.select().from(finClosingCash).where(and(...conds)).orderBy(asc(finClosingCash.date));
      headers = ["date", "outlet", "physical", "expected", "difference"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        r.outletId,
        String(r.physicalCash),
        String(r.expectedCash),
        String(r.cashDifference),
      ]);
      break;
    }
    case "summary": {
      const conds = [gte(finDailySummary.date, new Date(date_from)), lte(finDailySummary.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finDailySummary.outlet, filters_.outlet_id));
      const result = await db.select().from(finDailySummary).where(and(...conds)).orderBy(asc(finDailySummary.date));
      headers = ["date", "outlet", "revenue", "expense", "supplier", "petty", "net"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        r.outlet,
        String(r.revenue),
        String(r.expense),
        String(r.supplierCost),
        String(r.pettyCashOut),
        String(r.netProfitEstimate),
      ]);
      break;
    }
    case "profit": {
      const conds = [gte(finDailySummary.date, new Date(date_from)), lte(finDailySummary.date, new Date(date_to))];
      if (filters_.outlet_id) conds.push(eq(finDailySummary.outlet, filters_.outlet_id));
      const result = await db.select().from(finDailySummary).where(and(...conds)).orderBy(asc(finDailySummary.date));
      headers = ["date", "outlet", "revenue", "expense", "supplier", "petty", "net"];
      rows = result.map((r) => [
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
        r.outlet,
        String(r.revenue),
        String(r.expense),
        String(r.supplierCost),
        String(r.pettyCashOut),
        String(r.netProfitEstimate),
      ]);
      break;
    }
  }

  const stamp = todayWib().replace(/-/g, "");
  const filename = `ykp-finance-${report}-${date_from}_${date_to}-${stamp}.pdf`;
  const title = `YKP Finance - ${report} (${date_from} to ${date_to})`;
  const pdf = buildPdf({ title, headers, rows });
  const download_url = toDataUrl(pdf, "application/pdf");

  return ok({
    download_url,
    filename,
    mime_type: "application/pdf",
    byte_size: pdf.byteLength,
    row_count: rows.length,
    report,
    date_from,
    date_to,
    generated_by: user.id,
  });
});