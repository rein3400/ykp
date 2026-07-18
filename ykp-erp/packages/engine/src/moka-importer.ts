/**
 * @ykp/engine/moka-importer
 *
 * Parse a Moka POS CSV export into individual receipt rows for
 * `fin_pos_receipts`. Handles header normalization, IDR integer parsing
 * (strip "Rp" prefix + dots), and payment-method alias resolution.
 *
 * One CSV line → one receipt (no daily aggregation). Pre-aggregate rows
 * that explicitly set transaction_count > 1 are still emitted as a single
 * receipt with that count preserved.
 *
 * Output: receipt rows ready to insert + variance report listing rows that
 * were dropped, skipped, or required alias guesses.
 */

export interface MokaRawRow {
  [key: string]: string | undefined;
}

/** One receipt line from a Moka CSV export. */
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
  paymentMethod: string; // e.g. "PM-CASH" or raw label
  paymentAmount: number;
  paymentBreakdown: Record<string, number>;
  transactionCount: number;
  cashier?: string;
  shift?: string;
  sourceRef?: string;
  notes?: string;
}

export interface MokaVarianceEntry {
  row: number;
  field: string;
  reason: string;
  raw?: string;
}

export interface MokaParseResult {
  rows: MokaParsedReceipt[];
  errors: MokaVarianceEntry[];
  variance_report: {
    total_input_lines: number;
    parsed_lines: number;
    dropped_lines: number;
    alias_guesses: Record<string, string>;
  };
}

/**
 * @deprecated Use {@link MokaParsedReceipt}. Kept so finance import (Task 4)
 * still typechecks against the old aggregate-era name. `paymentMethodBreakdown`
 * / `aov` are optional bridges — prefer `paymentBreakdown`.
 */
export type MokaParsedRow = MokaParsedReceipt & {
  /** @deprecated use paymentBreakdown */
  paymentMethodBreakdown?: Record<string, number>;
  /** @deprecated daily AOV is derived from the view, not the parser */
  aov?: number;
};

/** @deprecated Use {@link MokaParseResult}. */
export type MokaImportResult = MokaParseResult;

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  tanggal: "date",
  transaction_date: "date",
  brand: "brandName",
  brand_name: "brandName",
  outlet: "outletName",
  outlet_name: "outletName",
  receipt_number: "receiptNumber",
  receipt: "receiptNumber",
  receipt_no: "receiptNumber",
  invoice: "receiptNumber",
  invoice_number: "receiptNumber",
  no_nota: "receiptNumber",
  nomor_nota: "receiptNumber",
  transaction_time: "transactionTime",
  time: "transactionTime",
  waktu: "transactionTime",
  gross_sales: "grossSales",
  gross: "grossSales",
  net_sales: "netSales",
  net: "netSales",
  discount: "discount",
  refund: "refund",
  void: "voidAmount",
  void_amount: "voidAmount",
  tax: "tax",
  service: "serviceCharge",
  service_charge: "serviceCharge",
  payment_method: "paymentMethod",
  payment: "paymentMethod",
  payment_amount: "paymentAmount",
  amount: "paymentAmount",
  transaction_count: "transactionCount",
  transactions: "transactionCount",
  cashier: "cashier",
  kasir: "cashier",
  shift: "shift",
  source_ref: "sourceRef",
  notes: "notes",
  catatan: "notes",
};

// Aliases map Moka-side payment labels to master fin_payment_method.method_id.
// Caller resolves these IDs against master before insert. The fallback is
// the literal alias string so a variance report can flag unresolved methods.
const PAYMENT_ALIASES: Record<string, string> = {
  tunai: "PM-CASH",
  cash: "PM-CASH",
  qris: "PM-QRIS",
  ovo: "PM-EWALLET",
  gopay: "PM-EWALLET",
  dana: "PM-EWALLET",
  shopeepay: "PM-EWALLET",
  debit: "PM-DEBIT",
  credit_card: "PM-DEBIT",
  transfer: "PM-TRANSFER",
};

/**
 * Parse an IDR-formatted string into a non-negative integer. Moka encodes
 * refund/void rows as negative literals (e.g. "-15000") — we strip the sign
 * so those rows are preserved. The caller is responsible for distinguishing
 * refund vs gross via the column name (`refund`, `void`).
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
  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s.trim())) {
    return s.trim().slice(0, 10);
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

interface ReceiptParseOutcome {
  receipt?: MokaParsedReceipt;
  errors: MokaVarianceEntry[];
  aliasGuess?: { raw: string; resolved: string };
}

/**
 * Parse a single mapped raw row into a receipt. Emits field-level errors
 * without throwing so the batch can continue.
 */
function parseMokaReceiptRow(
  raw: MokaRawRow,
  rowNumber: number,
  rawLine: string,
): ReceiptParseOutcome {
  const errors: MokaVarianceEntry[] = [];

  const date = normalizeDate(raw.date);
  const outletName = (raw.outletName ?? "").trim();
  const brandName = (raw.brandName ?? "").trim() || undefined;
  const receiptNumber = (raw.receiptNumber ?? "").trim();

  if (!date || !outletName) {
    errors.push({
      row: rowNumber,
      field: "date|outletName",
      reason: "missing date or outlet",
      raw: rawLine,
    });
    return { errors };
  }

  if (!receiptNumber) {
    errors.push({
      row: rowNumber,
      field: "receiptNumber",
      reason: "missing receipt number — export per-receipt format from Moka",
      raw: rawLine,
    });
    return { errors };
  }

  const paymentMethodRaw = (raw.paymentMethod ?? "unknown").trim().toLowerCase();
  const paymentMethod = PAYMENT_ALIASES[paymentMethodRaw] ?? (paymentMethodRaw || "Unknown");
  let aliasGuess: ReceiptParseOutcome["aliasGuess"];
  if (!PAYMENT_ALIASES[paymentMethodRaw] && paymentMethodRaw !== "unknown") {
    aliasGuess = { raw: paymentMethodRaw, resolved: paymentMethod };
  }

  let grossSales: number;
  let netSalesRaw: number;
  let discount: number;
  let refund: number;
  let voidAmount: number;
  let tax: number;
  let serviceCharge: number;
  let paymentAmountRaw: number;
  try {
    grossSales = parseIdrAmount(raw.grossSales);
    netSalesRaw = parseIdrAmount(raw.netSales);
    discount = parseIdrAmount(raw.discount);
    refund = parseIdrAmount(raw.refund);
    voidAmount = parseIdrAmount(raw.voidAmount);
    tax = parseIdrAmount(raw.tax);
    serviceCharge = parseIdrAmount(raw.serviceCharge);
    paymentAmountRaw = parseIdrAmount(raw.paymentAmount);
  } catch (parseErr) {
    errors.push({
      row: rowNumber,
      field: "amount",
      reason: parseErr instanceof Error ? parseErr.message : "invalid amount",
      raw: rawLine,
    });
    return { errors };
  }

  // Prefer explicit net_sales; otherwise derive from components.
  const netSales =
    raw.netSales !== undefined && raw.netSales !== ""
      ? netSalesRaw
      : Math.max(0, grossSales - discount - refund - voidAmount);

  // payment_amount defaults to netSales when the column is absent/empty.
  const paymentAmount =
    raw.paymentAmount !== undefined && raw.paymentAmount !== ""
      ? paymentAmountRaw
      : netSales;

  // Default 1 per receipt unless the row explicitly carries a pre-aggregate count.
  const explicitTx = raw.transactionCount?.trim();
  const transactionCount = explicitTx
    ? Math.max(1, Number.parseInt(explicitTx, 10) || 1)
    : 1;

  const paymentBreakdown: Record<string, number> = {
    [paymentMethod]: paymentAmount,
  };

  const receipt: MokaParsedReceipt = {
    date,
    outletName,
    brandName,
    receiptNumber,
    transactionTime: (raw.transactionTime ?? "").trim() || undefined,
    grossSales,
    discount,
    refund,
    voidAmount,
    tax,
    serviceCharge,
    netSales,
    paymentMethod,
    paymentAmount,
    paymentBreakdown,
    transactionCount,
    cashier: (raw.cashier ?? "").trim() || undefined,
    shift: (raw.shift ?? "").trim() || undefined,
    sourceRef: (raw.sourceRef ?? "").trim() || undefined,
    notes: (raw.notes ?? "").trim() || undefined,
  };

  // Bridge fields for legacy MokaParsedRow consumers (Task 4 will drop these).
  const bridged = receipt as MokaParsedRow;
  bridged.paymentMethodBreakdown = paymentBreakdown;
  bridged.aov = transactionCount > 0 ? Math.round(netSales / transactionCount) : 0;

  return { receipt: bridged, errors, aliasGuess };
}

/**
 * Parse a raw CSV string. The CSV is expected to have a header row.
 * Emits one {@link MokaParsedReceipt} per data line (no daily aggregation).
 */
export function parseMokaCsv(csvText: string): MokaParseResult {
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
  const result: MokaParsedReceipt[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const raw: MokaRawRow = {};
    mappedHeaders.forEach((h, idx) => {
      raw[h] = cells[idx];
    });

    const parsed = parseMokaReceiptRow(raw, i + 1, cells.join(","));
    if (parsed.aliasGuess) {
      aliasGuesses[parsed.aliasGuess.raw] = parsed.aliasGuess.resolved;
    }
    if (parsed.errors.length) {
      errors.push(...parsed.errors);
    }
    if (parsed.receipt) {
      result.push(parsed.receipt);
    }
  }

  return {
    rows: result,
    errors,
    variance_report: {
      total_input_lines: rows.length - 1,
      parsed_lines: result.length,
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
