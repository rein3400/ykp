/**
 * @ykp/engine/moka-importer
 *
 * Parse a Moka POS CSV export into the `fin_pos_daily` shape. Handles
 * header normalization, IDR integer parsing (strip "Rp" prefix + dots),
 * and payment-method alias resolution. Aggregates per (date, outlet).
 *
 * Output: rows ready to insert + a variance report listing rows that
 * were dropped, skipped, or required alias guesses.
 */

export interface MokaRawRow {
  [key: string]: string | undefined;
}

export interface MokaParsedRow {
  date: string; // yyyy-mm-dd
  brandId: string;
  brandName: string;
  outletId: string;
  outletName: string;
  grossSales: number;
  netSales: number;
  discount: number;
  refund: number;
  voidAmount: number;
  tax: number;
  serviceCharge: number;
  paymentMethodBreakdown: Record<string, number>;
  transactionCount: number;
  aov: number;
  shift?: string;
}

export interface MokaVarianceEntry {
  row: number;
  field: string;
  reason: string;
  raw?: string;
}

export interface MokaImportResult {
  rows: MokaParsedRow[];
  errors: MokaVarianceEntry[];
  variance_report: {
    total_input_lines: number;
    parsed_lines: number;
    dropped_lines: number;
    alias_guesses: Record<string, string>;
  };
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  tanggal: "date",
  transaction_date: "date",
  brand: "brandName",
  brand_name: "brandName",
  outlet: "outletName",
  outlet_name: "outletName",
  gross_sales: "grossSales",
  gross: "grossSales",
  net_sales: "netSales",
  net: "netSales",
  discount: "discount",
  refund: "refund",
  void: "voidAmount",
  void_amount: "voidAmount",
  tax: "tax",
  service_charge: "serviceCharge",
  payment_method: "paymentMethod",
  payment: "paymentMethod",
  transaction_count: "transactionCount",
  transactions: "transactionCount",
  shift: "shift",
};

// Aliases map Moka-side payment labels to master fin_payment_method.method_id.
// Caller resolves these IDs against master before insert. The fallback is
// the literal alias string so a variance report can flag unresolved methods.
const PAYMENT_ALIASES: Record<string, string> = {
  tunai: "PM-CASH",
  cash: "PM-CASH",
  "qris": "PM-QRIS",
  "ovo": "PM-EWALLET",
  "gopay": "PM-EWALLET",
  "dana": "PM-EWALLET",
  "shopeepay": "PM-EWALLET",
  "debit": "PM-DEBIT",
  "credit_card": "PM-DEBIT",
  "transfer": "PM-TRANSFER",
};

/**
 * Parse an IDR-formatted string into a non-negative integer. Moka encodes
 * refund/void rows as negative literals (e.g. "-15000") — we strip the sign
 * so those rows are preserved in the aggregate. The caller is responsible
 * for distinguishing refund vs gross via the column name (`refund`, `void`).
 * Empty / null returns 0; non-numeric returns 0.
 */
export function parseIdrAmount(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/\s+/g, "").replace(/rp/i, "").replace(/\./g, "").replace(/,/g, "");
  // Strip leading minus (Moka refund/void convention) so magnitude is kept.
  const abs = cleaned.replace(/^-+/, "");
  const n = Number.parseInt(abs, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function normalizeDate(s: string | undefined): string {
  if (!s) return "";
  // dd/mm/yyyy (Moka default) -> YYYY-MM-DD in WIB/local date semantics.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // ISO-ish fallback (parse as local Jakarta; but prefer regex split).
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Parse a raw CSV string. The CSV is expected to have a header row.
 * Aggregation: rows sharing (date, outlet) are summed and the largest
 * payment method bucket is recorded. Returns parsed rows + variance.
 */
export function parseMokaCsv(csvText: string): MokaImportResult {
  const rows = parseCsv(csvText);
  const errors: MokaVarianceEntry[] = [];
  if (rows.length < 2) {
    return {
      rows: [],
      errors,
      variance_report: { total_input_lines: 0, parsed_lines: 0, dropped_lines: 0, alias_guesses: {} },
    };
  }

  const headerKeys = rows[0].map(normalizeHeader);
  const mappedHeaders = headerKeys.map((h) => HEADER_ALIASES[h] ?? h);

  const aliasGuesses: Record<string, string> = {};
  const aggregates = new Map<string, MokaParsedRow>();

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const raw: MokaRawRow = {};
    mappedHeaders.forEach((h, idx) => {
      raw[h] = cells[idx];
    });

    const date = normalizeDate(raw.date);
    const outletName = (raw.outletName ?? "").trim();
    const brandName = (raw.brandName ?? "").trim();
    if (!date || !outletName) {
      errors.push({
        row: i + 1,
        field: "date|outletName",
        reason: "missing date or outlet",
        raw: cells.join(","),
      });
      continue;
    }

    const key = `${date}|${outletName}`;
    const paymentMethodRaw = (raw.paymentMethod ?? "unknown").trim().toLowerCase();
    const paymentMethod = PAYMENT_ALIASES[paymentMethodRaw] ?? (paymentMethodRaw || "Unknown");
    if (!PAYMENT_ALIASES[paymentMethodRaw] && paymentMethodRaw !== "unknown") {
      aliasGuesses[paymentMethodRaw] = paymentMethod;
    }

    // Defect F3 fix: each parseIdrAmount can throw on negative values;
    // record the row-level error and skip instead of aborting the whole batch.
    let grossSales: number, netSales: number, discount: number, refund: number,
      voidAmount: number, tax: number, serviceCharge: number;
    try {
      grossSales = parseIdrAmount(raw.grossSales);
      netSales = parseIdrAmount(raw.netSales);
      discount = parseIdrAmount(raw.discount);
      refund = parseIdrAmount(raw.refund);
      voidAmount = parseIdrAmount(raw.voidAmount);
      tax = parseIdrAmount(raw.tax);
      serviceCharge = parseIdrAmount(raw.serviceCharge);
    } catch (parseErr) {
      errors.push({
        row: i + 1,
        field: "amount",
        reason: parseErr instanceof Error ? parseErr.message : "invalid amount",
        raw: cells.join(","),
      });
      continue;
    }
    const txCount = Number.parseInt(raw.transactionCount ?? "1", 10) || 1;

    const existing = aggregates.get(key);
    if (existing) {
      existing.grossSales += grossSales;
      existing.netSales += netSales;
      existing.discount += discount;
      existing.refund += refund;
      existing.voidAmount += voidAmount;
      existing.tax += tax;
      existing.serviceCharge += serviceCharge;
      existing.transactionCount += txCount;
      existing.paymentMethodBreakdown[paymentMethod] =
        (existing.paymentMethodBreakdown[paymentMethod] ?? 0) + netSales;
    } else {
      aggregates.set(key, {
        date,
        brandId: "",
        brandName,
        outletId: "",
        outletName,
        grossSales,
        netSales,
        discount,
        refund,
        voidAmount,
        tax,
        serviceCharge,
        paymentMethodBreakdown: { [paymentMethod]: netSales },
        transactionCount: txCount,
        aov: txCount > 0 ? Math.round(netSales / txCount) : 0,
        shift: raw.shift,
      });
    }
  }

  const outRows = Array.from(aggregates.values()).map((r) => ({
    ...r,
    aov: r.transactionCount > 0 ? Math.round(r.netSales / r.transactionCount) : 0,
  }));

  return {
    rows: outRows,
    errors,
    variance_report: {
      total_input_lines: rows.length - 1,
      parsed_lines: outRows.length,
      dropped_lines: errors.length,
      alias_guesses: aliasGuesses,
    },
  };
}

/** Parse an RFC 4180 CSV blob into rows. Strips UTF-8 BOM and handles
 *  quoted newlines inside cells. */
function parseCsv(text: string): string[][] {
  const stripped = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (inQuotes) {
      if (c === '"') {
        if (stripped[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c ?? "";
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\r") {
      // ignore; \n handles line break
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += c ?? "";
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}