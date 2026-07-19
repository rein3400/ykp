/**
 * Moka POS CSV importer (ported from ykp-erp engine moka-importer.ts, keeping
 * its bug fixes: negative refund/void magnitude parsing, dd/mm/yyyy WIB dates,
 * per-row error capture instead of aborting the batch).
 *
 * Parse a Moka POS CSV export into fin_pos_daily-shaped aggregates.
 * Handles header normalization, IDR integer parsing (strip "Rp" + dots),
 * payment-method → settlement-bucket alias resolution (Revisi #5:
 * Cash/QRIS/Card/Transfer/Marketplace). Aggregates per (date, outlet).
 *
 * Output: rows ready to insert + a variance report listing rows that were
 * dropped, skipped, or required alias guesses.
 *
 * Pure — no I/O, no Node deps.
 */

export interface MokaParsedRow {
  date: string; // yyyy-mm-dd
  brandName: string;
  outletName: string;
  grossSales: number;
  netSales: number;
  discount: number;
  refund: number;
  voidAmount: number;
  tax: number;
  serviceCharge: number;
  settlement: { cash: number; qris: number; card: number; transfer: number; marketplace: number };
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
  date: 'date',
  tanggal: 'date',
  transaction_date: 'date',
  brand: 'brandName',
  brand_name: 'brandName',
  outlet: 'outletName',
  outlet_name: 'outletName',
  gross_sales: 'grossSales',
  gross: 'grossSales',
  net_sales: 'netSales',
  net: 'netSales',
  discount: 'discount',
  refund: 'refund',
  void: 'voidAmount',
  void_amount: 'voidAmount',
  tax: 'tax',
  service_charge: 'serviceCharge',
  payment_method: 'paymentMethod',
  payment: 'paymentMethod',
  transaction_count: 'transactionCount',
  transactions: 'transactionCount',
  shift: 'shift'
};

// Moka payment labels → settlement buckets (Revisi #5).
// Unknown labels fall back to the literal string so the variance report can
// flag unresolved methods; the route layer decides whether to reject.
const PAYMENT_BUCKET_ALIASES: Record<string, 'cash' | 'qris' | 'card' | 'transfer' | 'marketplace'> = {
  tunai: 'cash',
  cash: 'cash',
  qris: 'qris',
  ovo: 'qris',
  gopay: 'qris',
  dana: 'qris',
  shopeepay: 'qris',
  ewallet: 'qris',
  e_wallet: 'qris',
  debit: 'card',
  debit_card: 'card',
  credit_card: 'card',
  kartu: 'card',
  card: 'card',
  transfer: 'transfer',
  transfer_bank: 'transfer',
  marketplace: 'marketplace',
  gofood: 'marketplace',
  grabfood: 'marketplace',
  shopeefood: 'marketplace',
  online: 'marketplace'
};

/**
 * Parse an IDR-formatted string into a non-negative integer. Moka encodes
 * refund/void rows as negative literals (e.g. "-15000") — strip the sign so
 * magnitude is preserved. Empty / null returns 0; non-numeric returns 0.
 */
export function parseIdrAmount(s: string | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/\s+/g, '').replace(/rp/i, '').replace(/\./g, '').replace(/,/g, '');
  // Strip leading minus (Moka refund/void convention) so magnitude is kept.
  const abs = cleaned.replace(/^-+/, '');
  const n = Number.parseInt(abs, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function normalizeDate(s: string | undefined): string {
  if (!s) return '';
  // dd/mm/yyyy (Moka default) -> YYYY-MM-DD in WIB/local date semantics.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // ISO fallback (YYYY-MM-DD already fine)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return s.trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse a raw CSV string. Expects a header row. Rows sharing (date, outlet)
 * are summed; settlement buckets accumulate per method. Returns parsed rows
 * + variance report.
 */
export function parseMokaCsv(csvText: string): MokaImportResult {
  const rows = parseCsv(csvText);
  const errors: MokaVarianceEntry[] = [];
  if (rows.length < 2) {
    return {
      rows: [],
      errors,
      variance_report: { total_input_lines: 0, parsed_lines: 0, dropped_lines: 0, alias_guesses: {} }
    };
  }

  const headerKeys = rows[0].map(normalizeHeader);
  const mappedHeaders = headerKeys.map((h) => HEADER_ALIASES[h] ?? h);

  const aliasGuesses: Record<string, string> = {};
  const aggregates = new Map<string, MokaParsedRow>();

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const raw: Record<string, string | undefined> = {};
    mappedHeaders.forEach((h, idx) => {
      raw[h] = cells[idx];
    });

    const date = normalizeDate(raw.date);
    const outletName = (raw.outletName ?? '').trim();
    const brandName = (raw.brandName ?? '').trim();
    if (!date || !outletName) {
      errors.push({ row: i + 1, field: 'date|outletName', reason: 'missing date or outlet', raw: cells.join(',') });
      continue;
    }

    const key = `${date}|${outletName}`;
    const paymentMethodRaw = (raw.paymentMethod ?? 'unknown').trim().toLowerCase();
    const bucket = PAYMENT_BUCKET_ALIASES[paymentMethodRaw];
    if (!bucket && paymentMethodRaw !== 'unknown') {
      aliasGuesses[paymentMethodRaw] = 'unresolved';
    }

    // Defect F3 fix (ported): per-row parse errors skip the row, never abort batch.
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
        field: 'amount',
        reason: parseErr instanceof Error ? parseErr.message : 'invalid amount',
        raw: cells.join(',')
      });
      continue;
    }
    const txCount = Number.parseInt(raw.transactionCount ?? '1', 10) || 1;

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
      if (bucket) existing.settlement[bucket] += netSales;
    } else {
      aggregates.set(key, {
        date,
        brandName,
        outletName,
        grossSales,
        netSales,
        discount,
        refund,
        voidAmount,
        tax,
        serviceCharge,
        settlement: {
          cash: bucket === 'cash' ? netSales : 0,
          qris: bucket === 'qris' ? netSales : 0,
          card: bucket === 'card' ? netSales : 0,
          transfer: bucket === 'transfer' ? netSales : 0,
          marketplace: bucket === 'marketplace' ? netSales : 0
        },
        transactionCount: txCount,
        aov: txCount > 0 ? Math.round(netSales / txCount) : 0,
        shift: raw.shift
      });
    }
  }

  const outRows = Array.from(aggregates.values()).map((r) => ({
    ...r,
    aov: r.transactionCount > 0 ? Math.round(r.netSales / r.transactionCount) : 0
  }));

  return {
    rows: outRows,
    errors,
    variance_report: {
      total_input_lines: rows.length - 1,
      parsed_lines: outRows.length,
      dropped_lines: errors.length,
      alias_guesses: aliasGuesses
    }
  };
}

/** Parse an RFC 4180 CSV blob into rows. Strips UTF-8 BOM, handles quoted cells. */
export function parseCsv(text: string): string[][] {
  const stripped = text.startsWith('﻿') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
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
        cur += c ?? '';
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\r') {
      // ignore; \n handles line break
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += c ?? '';
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}
