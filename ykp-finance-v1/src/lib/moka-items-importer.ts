/**
 * Moka POS item-sales CSV importer (item-level counterpart of moka-importer).
 * Parses Moka "Item Sales / Penjualan Item" export into fin_pos_items-shaped
 * rows. Same conventions: header aliases (EN+ID), IDR integer parsing,
 * dd/mm/yyyy dates, per-row error capture, duplicate (date, outlet, item)
 * aggregation.
 *
 * Pure — no I/O, no Node deps.
 */
import { parseCsv, parseIdrAmount, normalizeDate } from './moka-importer';

export interface MokaItemRow {
  date: string; // yyyy-mm-dd
  outletName: string;
  brandName: string;
  itemName: string;
  sku: string;
  category: string;
  qty: number;
  grossSales: number;
  discount: number;
  refund: number;
  netSales: number;
}

export interface MokaItemsImportResult {
  rows: MokaItemRow[];
  errors: { row: number; field: string; reason: string; raw?: string }[];
  variance_report: {
    total_input_lines: number;
    parsed_lines: number;
    dropped_lines: number;
  };
}

const HEADER_ALIASES: Record<string, string> = {
  date: 'date',
  tanggal: 'date',
  outlet: 'outletName',
  outlet_name: 'outletName',
  nama_outlet: 'outletName',
  brand: 'brandName',
  brand_name: 'brandName',
  item: 'itemName',
  item_name: 'itemName',
  nama_item: 'itemName',
  product: 'itemName',
  product_name: 'itemName',
  produk: 'itemName',
  menu: 'itemName',
  sku: 'sku',
  category: 'category',
  kategori: 'category',
  item_category: 'category',
  qty: 'qty',
  quantity: 'qty',
  quantity_sold: 'qty',
  jumlah: 'qty',
  jumlah_terjual: 'qty',
  terjual: 'qty',
  gross_sales: 'grossSales',
  gross: 'grossSales',
  penjualan_kotor: 'grossSales',
  discount: 'discount',
  diskon: 'discount',
  refund: 'refund',
  net_sales: 'netSales',
  net: 'netSales',
  penjualan_bersih: 'netSales'
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse a raw item-sales CSV string. Expects a header row. Rows sharing
 * (date, outlet, item_name) are summed. Returns parsed rows + variance.
 */
export function parseMokaItemsCsv(csvText: string): MokaItemsImportResult {
  const rows = parseCsv(csvText);
  const errors: MokaItemsImportResult['errors'] = [];
  const empty = {
    rows: [] as MokaItemRow[],
    errors,
    variance_report: { total_input_lines: 0, parsed_lines: 0, dropped_lines: 0 }
  };
  if (rows.length < 2) return empty;

  const mappedHeaders = rows[0].map((h) => HEADER_ALIASES[normalizeHeader(h)] ?? normalizeHeader(h));
  const aggregates = new Map<string, MokaItemRow>();

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip blank lines
    if (cells.every((c) => !c.trim())) continue;
    const raw: Record<string, string | undefined> = {};
    mappedHeaders.forEach((h, idx) => {
      raw[h] = cells[idx];
    });

    const date = normalizeDate(raw.date);
    const outletName = (raw.outletName ?? '').trim();
    const itemName = (raw.itemName ?? '').trim();
    if (!date || !outletName || !itemName) {
      errors.push({ row: i + 1, field: 'date|outlet|item', reason: 'missing date, outlet, or item name', raw: cells.join(',') });
      continue;
    }

    const key = `${date}|${outletName}|${itemName}`;
    const qty = parseIdrAmount(raw.qty);
    const gross = parseIdrAmount(raw.grossSales);
    const discount = parseIdrAmount(raw.discount);
    const refund = parseIdrAmount(raw.refund);
    const net = parseIdrAmount(raw.netSales);

    const existing = aggregates.get(key);
    if (existing) {
      existing.qty += qty;
      existing.grossSales += gross;
      existing.discount += discount;
      existing.refund += refund;
      existing.netSales += net;
    } else {
      aggregates.set(key, {
        date,
        outletName,
        brandName: (raw.brandName ?? '').trim(),
        itemName,
        sku: (raw.sku ?? '').trim(),
        category: (raw.category ?? '').trim(),
        qty,
        grossSales: gross,
        discount,
        refund,
        netSales: net
      });
    }
  }

  return {
    rows: [...aggregates.values()],
    errors,
    variance_report: {
      total_input_lines: rows.length - 1,
      parsed_lines: aggregates.size,
      dropped_lines: errors.length
    }
  };
}
