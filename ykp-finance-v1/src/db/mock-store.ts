/**
 * In-memory mock DB for local demo / offline development.
 * Self-contained (no import from sheets.ts) to avoid circular deps.
 * Activated when USE_MOCK_DB=true or Google Sheets env is missing.
 *
 * Schema matches sheets.ts TABS. Sample data per YKP_ERP_List_Revisi_Developer
 * item #1 (real test data, not empty states): 5 brands, 7 outlets, 10 suppliers,
 * 14 hari POS/petty/expense/supplier/closing termasuk:
 *  - satu "refund day" (refund/void tinggi → alert)
 *  - satu "cash diff day" (selisih kas Rp75.000 → CASH_DIFFERENCE HIGH)
 *  - satu hari petty cash di atas limit harian
 *  - satu hari expense spike (>20% vs rata-rata 7 hari)
 *  - supplier PAID/PARTIAL/UNPAID/OVERDUE/CANCELLED + cross-link anti double-count
 */
import { createHash } from 'crypto';

// ── Deterministic PRNG (stable demo data within a process) ──────
let seedNum = 42;
function rnd(): number {
  seedNum = (seedNum * 1103515245 + 12345) % 2147483648;
  return seedNum / 2147483648;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(rnd() * arr.length)]; }

function todayWib(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}
function dateOffset(daysAgo: number): string {
  // Format the offset day directly in Asia/Jakarta. The previous version built
  // `${todayWib}T00:00:00+07:00` then called toISOString() (UTC), which shifted
  // every generated date BACK one day — so "today" (day 0) never had data.
  const d = new Date(Date.now() - daysAgo * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// String keys must match TABS values in sheets.ts
const TAB = {
  brands: 'master_brand',
  outlets: 'master_outlet',
  suppliers: 'master_supplier',
  expenseCategories: 'fin_expense_category',
  paymentMethods: 'fin_payment_method',
  pettyCashAccounts: 'fin_petty_cash_account',
  posDaily: 'fin_pos_daily',
  supplierCost: 'fin_supplier_cost',
  pettyCash: 'fin_petty_cash',
  expense: 'fin_expense',
  closingCash: 'fin_closing_cash',
  dailySummary: 'fin_daily_summary',
  alertLog: 'finance_alert_log',
  actionTracker: 'finance_action_tracker',
  thresholdConfig: 'finance_threshold_config',
  users: 'users',
  auditLog: 'audit_log',
  telegramDeliveryLog: 'telegram_delivery_log',
  payroll: 'hr_payroll'
} as const;

const BRANDS = [
  ['BR-001', 'Funkydak', 'FKD', 'funkydak@gmail.com'],
  ['BR-002', 'Sekarpizza', 'SKP', 'sekarpizza@gmail.com'],
  ['BR-003', 'Suburbuns', 'SBN', 'suburbunsyk@gmail.com'],
  ['BR-004', 'Laju Kopi', 'LJK', ''],
  ['BR-005', 'Uncle Masala', 'UMS', '']
] as const;

const OUTLETS = [
  { id: 'OL-001', brand: 'BR-001', name: 'Funkydak Cipete', code: 'FKD-01', base: 5200000 },
  { id: 'OL-002', brand: 'BR-001', name: 'Funkydak Kemang', code: 'FKD-02', base: 4100000 },
  { id: 'OL-003', brand: 'BR-002', name: 'Sekarpizza Demangan', code: 'SKP-01', base: 3800000 },
  { id: 'OL-004', brand: 'BR-002', name: 'Sekarpizza Seturan', code: 'SKP-02', base: 3200000 },
  { id: 'OL-005', brand: 'BR-003', name: 'Suburbuns Depok', code: 'SBN-01', base: 2600000 },
  { id: 'OL-006', brand: 'BR-004', name: 'Laju Kopi Bintaro', code: 'LJK-01', base: 2200000 },
  { id: 'OL-007', brand: 'BR-005', name: 'Uncle Masala Tebet', code: 'UMS-01', base: 2900000 }
] as const;

const SUPPLIERS = [
  ['SUP-001', 'CV Sumber Ayam Segar', 'Bahan Baku'],
  ['SUP-002', 'Toko Daging Sapi Makmur', 'Bahan Baku'],
  ['SUP-003', 'UD Tepung & Bahan Kering', 'Bahan Baku'],
  ['SUP-004', 'CV Packaging Jaya', 'Packaging'],
  ['SUP-005', 'Sayur Segar Nusantara', 'Bahan Baku'],
  ['SUP-006', 'Kopi Nusantara Roastery', 'Bahan Baku'],
  ['SUP-007', 'Susu & Dairy Fresh', 'Bahan Baku'],
  ['SUP-008', 'CV Transport Cepat', 'Transport'],
  ['SUP-009', 'Gas & Energi Pratama', 'Operational'],
  ['SUP-010', 'Alat Dapur Lengkap', 'Equipment']
] as const;

const EXPENSE_CATEGORIES = [
  'Sewa', 'Gaji', 'Listrik', 'Air', 'Internet', 'Gas', 'Maintenance', 'Marketing',
  'Transport', 'Packaging', 'Refund', 'Diskon', 'Peralatan', 'Operational Mendadak', 'Other'
] as const;

const CASHIERS = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko'];

function seed(): Record<string, Record<string, string>[]> {
  const t = now();
  const pwOwner = createHash('sha256').update('owner123').digest('hex');
  const pwFinance = createHash('sha256').update('finance123').digest('hex');
  const brandName = (id: string) => BRANDS.find((b) => b[0] === id)?.[1] ?? id;

  // ── POS daily: 7 outlets × 14 hari ────────────────────────────
  const pos: Record<string, string>[] = [];
  let posSeq = 1;
  for (let day = 13; day >= 0; day--) {
    const date = dateOffset(day);
    const dow = new Date(`${date}T00:00:00+07:00`).getUTCDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.2 : 1;
    for (const o of OUTLETS) {
      const jitter = 0.85 + rnd() * 0.3;
      const gross = Math.round(o.base * jitter * weekendBoost / 1000) * 1000;
      const discount = Math.round(gross * 0.02 / 1000) * 1000;
      // Refund day: 10 hari lalu OL-001 & OL-003 refund ~8% gross
      const refund = day === 10 && (o.id === 'OL-001' || o.id === 'OL-003')
        ? Math.round(gross * 0.08 / 1000) * 1000
        : 0;
      const voidAmt = Math.round(gross * 0.005 / 1000) * 1000;
      const net = gross - discount - refund - voidAmt;
      const aovTarget = 45000 + Math.round(rnd() * 20000);
      const txCount = Math.max(1, Math.round(net / aovTarget));
      const aov = Math.round(net / txCount);
      // Settlement split 45/30/15/5/5
      let cash = Math.round(net * 0.45 / 1000) * 1000;
      const qris = Math.round(net * 0.30 / 1000) * 1000;
      const card = Math.round(net * 0.15 / 1000) * 1000;
      const transfer = Math.round(net * 0.05 / 1000) * 1000;
      const marketplace = net - cash - qris - card - transfer;
      // Cash diff day: 4 hari lalu OL-002 kas kurang Rp75.000
      let settleDiff = 0;
      if (day === 4 && o.id === 'OL-002') { cash -= 75000; settleDiff = 75000; }
      const totalSettlement = cash + qris + card + transfer + marketplace;
      pos.push({
        pos_id: `POS-${String(posSeq++).padStart(4, '0')}`,
        date,
        brand_id: o.brand,
        brand_name: brandName(o.brand),
        outlet_id: o.id,
        outlet_name: o.name,
        gross_sales: String(gross),
        net_sales: String(net),
        discount: String(discount),
        refund: String(refund),
        void: String(voidAmt),
        tax: '0',
        service_charge: '0',
        settle_cash: String(cash),
        settle_qris: String(qris),
        settle_card: String(card),
        settle_transfer: String(transfer),
        settle_marketplace: String(marketplace),
        total_settlement: String(totalSettlement),
        settlement_difference: String(settleDiff),
        transaction_count: String(txCount),
        aov: String(aov),
        cashier: pick(CASHIERS),
        shift: rnd() > 0.5 ? 'Pagi' : 'Malam',
        payment_method: 'Cash',
        source: rnd() > 0.2 ? 'moka' : 'manual',
        source_ref: '',
        notes: '',
        source_module: 'pos',
        source_transaction_id: '',
        payment_source: '',
        linked_expense_id: '',
        linked_supplier_invoice_id: '',
        linked_petty_cash_id: '',
        created_by: 'USR-002',
        created_at: t,
        updated_at: t
      });
    }
  }

  // ── Supplier costing: 25 rows, berbagai status ────────────────
  const supCosts: Record<string, string>[] = [];
  let supSeq = 1;
  const supItems = [
    'Ayam fillet 25kg', 'Daging sapi 15kg', 'Tepung terigu 50kg', 'Box pizza 500pcs',
    'Sayuran mix 20kg', 'Biji kopi arabica 10kg', 'Susu fresh 30 liter',
    'Gas LPG 12kg x4', 'Ongkir distribusi', 'Pisau & alat dapur'
  ];
  function addSupCost(opts: {
    day: number; outletIdx: number; supplierIdx: number; item: string;
    total: number; status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'CANCELLED';
    paidPct?: number; dueInDays?: number; noInvoice?: boolean; linkedExpenseId?: string;
    linkedPettyCashId?: string; paymentSource?: string;
  }): string {
    const o = OUTLETS[opts.outletIdx];
    const s = SUPPLIERS[opts.supplierIdx];
    const date = dateOffset(opts.day);
    const paid = opts.status === 'PAID' ? opts.total
      : opts.status === 'PARTIAL' ? Math.round(opts.total * (opts.paidPct ?? 0.5))
      : 0;
    const unpaid = opts.status === 'CANCELLED' ? 0 : opts.total - paid;
    const due = opts.status === 'UNPAID'
      ? dateOffset(-(opts.dueInDays ?? 7))
      : opts.status === 'OVERDUE'
        ? dateOffset(opts.dueInDays ?? 3)
        : date;
    const id = `SUPC-${String(supSeq++).padStart(4, '0')}`;
    supCosts.push({
      costing_id: id,
      date_order: date,
      brand_id: o.brand,
      brand_name: brandName(o.brand),
      outlet_id: o.id,
      outlet_name: o.name,
      supplier_id: s[0],
      supplier_name: s[1],
      description: opts.item,
      category: s[2],
      qty: '1',
      unit: 'paket',
      unit_price: String(opts.total),
      total_amount: String(opts.total),
      paid_amount: String(paid),
      unpaid_amount: String(unpaid),
      payment_status: opts.status,
      due_date: due,
      bank_account: 'BCA 123456789',
      invoice_number: `INV-2026-${String(supSeq).padStart(3, '0')}`,
      invoice_url: opts.noInvoice ? '' : `https://drive.example.com/nota/${id}.jpg`,
      receipt_url: paid > 0 ? `https://drive.example.com/bukti-bayar/${id}.jpg` : '',
      approval_status: opts.status === 'PAID' ? 'PAID'
        : opts.status === 'UNPAID' ? 'PENDING'
        : opts.status === 'CANCELLED' ? 'CANCELLED' : 'APPROVED',
      approved_by: opts.status === 'UNPAID' || opts.status === 'CANCELLED' ? '' : 'USR-001',
      payment_date: paid > 0 && opts.status === 'PAID' ? date : '',
      payment_ref: paid > 0 && opts.status === 'PAID' ? `TRF-${id}` : '',
      notes: '',
      source_module: 'supplier',
      source_transaction_id: '',
      payment_source: opts.paymentSource ?? (paid > 0 ? 'transfer' : ''),
      linked_expense_id: opts.linkedExpenseId ?? '',
      linked_petty_cash_id: opts.linkedPettyCashId ?? '',
      created_by: 'USR-002',
      created_at: t,
      updated_at: t
    });
    return id;
  }

  addSupCost({ day: 13, outletIdx: 0, supplierIdx: 0, item: supItems[0], total: 1750000, status: 'PAID' });
  addSupCost({ day: 13, outletIdx: 2, supplierIdx: 2, item: supItems[2], total: 980000, status: 'PAID' });
  addSupCost({ day: 12, outletIdx: 1, supplierIdx: 1, item: supItems[1], total: 2100000, status: 'PAID' });
  addSupCost({ day: 12, outletIdx: 4, supplierIdx: 4, item: supItems[4], total: 620000, status: 'PAID' });
  addSupCost({ day: 11, outletIdx: 5, supplierIdx: 5, item: supItems[5], total: 1350000, status: 'PARTIAL', paidPct: 0.5 });
  addSupCost({ day: 11, outletIdx: 0, supplierIdx: 3, item: supItems[3], total: 750000, status: 'PAID' });
  // Harga ayam naik 18% (narrative issue untuk summary)
  addSupCost({ day: 10, outletIdx: 0, supplierIdx: 0, item: supItems[0], total: 2065000, status: 'PARTIAL', paidPct: 0.4 });
  addSupCost({ day: 10, outletIdx: 6, supplierIdx: 4, item: supItems[4], total: 540000, status: 'PAID' });
  addSupCost({ day: 9, outletIdx: 2, supplierIdx: 1, item: supItems[1], total: 1890000, status: 'UNPAID', dueInDays: 5 });
  addSupCost({ day: 9, outletIdx: 3, supplierIdx: 2, item: supItems[2], total: 870000, status: 'PAID' });
  // Overdue invoices (jatuh tempo lewat 3 / 8 / 10 / 15 hari)
  addSupCost({ day: 8, outletIdx: 0, supplierIdx: 6, item: supItems[6], total: 1150000, status: 'OVERDUE', dueInDays: 3 });
  addSupCost({ day: 8, outletIdx: 1, supplierIdx: 0, item: supItems[0], total: 1680000, status: 'OVERDUE', dueInDays: 8 });
  addSupCost({ day: 7, outletIdx: 2, supplierIdx: 3, item: supItems[3], total: 690000, status: 'OVERDUE', dueInDays: 10 });
  addSupCost({ day: 7, outletIdx: 5, supplierIdx: 7, item: supItems[8], total: 350000, status: 'OVERDUE', dueInDays: 15 });
  addSupCost({ day: 6, outletIdx: 4, supplierIdx: 2, item: supItems[2], total: 910000, status: 'PAID' });
  addSupCost({ day: 6, outletIdx: 6, supplierIdx: 8, item: supItems[7], total: 480000, status: 'PAID' });
  addSupCost({ day: 5, outletIdx: 0, supplierIdx: 9, item: supItems[9], total: 2300000, status: 'UNPAID', dueInDays: 10, noInvoice: true });
  addSupCost({ day: 4, outletIdx: 3, supplierIdx: 4, item: supItems[4], total: 560000, status: 'PAID' });
  addSupCost({ day: 3, outletIdx: 1, supplierIdx: 2, item: supItems[2], total: 940000, status: 'PARTIAL', paidPct: 0.6 });
  addSupCost({ day: 2, outletIdx: 2, supplierIdx: 0, item: supItems[0], total: 1720000, status: 'UNPAID', dueInDays: 7 });
  addSupCost({ day: 1, outletIdx: 0, supplierIdx: 1, item: supItems[1], total: 1980000, status: 'UNPAID', dueInDays: 6 });
  addSupCost({ day: 0, outletIdx: 0, supplierIdx: 0, item: supItems[0], total: 1810000, status: 'UNPAID', dueInDays: 7 });
  addSupCost({ day: 0, outletIdx: 6, supplierIdx: 5, item: supItems[5], total: 1280000, status: 'CANCELLED' });
  // Cross-link demo (Revisi #4): pembelian supplier dicatat juga sebagai expense.
  // Supplier row ini dikecualikan dari supplier_cost (expense adalah primary).
  addSupCost({ day: 5, outletIdx: 2, supplierIdx: 4, item: 'Sayur urgent via expense', total: 320000, status: 'PAID', linkedExpenseId: 'EXP-LINK-1' });
  // Cross-link demo: invoice supplier dibayar lewat kas kecil.
  // Petty row PC-LINK-1 membawa linked_supplier_invoice_id → dikecualikan dari petty_cash_out.
  const paidViaPettyId = addSupCost({ day: 3, outletIdx: 0, supplierIdx: 3, item: 'Box kemasan dibayar kas kecil', total: 450000, status: 'PAID', paymentSource: 'petty_cash' });

  // ── Petty cash: top-up + pengeluaran per akun ─────────────────
  const petty: Record<string, string>[] = [];
  let pcSeq = 1;
  const balances: Record<string, number> = {};
  function addPetty(opts: {
    day: number; outletIdx: number; desc: string; debit?: number; credit?: number;
    urgent?: boolean; approval?: string; linkedExpenseId?: string; linkedSupplierInvoiceId?: string;
    idOverride?: string; category?: string; noReceipt?: boolean;
  }): void {
    const o = OUTLETS[opts.outletIdx];
    const accId = `PCA-${String(opts.outletIdx + 1).padStart(3, '0')}`;
    const date = dateOffset(opts.day);
    balances[accId] = (balances[accId] ?? 0) + (opts.debit ?? 0) - (opts.credit ?? 0);
    const id = opts.idOverride ?? `PC-${String(pcSeq++).padStart(4, '0')}`;
    petty.push({
      petty_id: id,
      date,
      brand_id: o.brand,
      brand_name: brandName(o.brand),
      outlet_id: o.id,
      outlet_name: o.name,
      account_id: accId,
      description: opts.desc,
      category: opts.category ?? 'Operational',
      qty: '1',
      unit: 'item',
      debit_topup: String(opts.debit ?? 0),
      credit_out: String(opts.credit ?? 0),
      running_balance: String(balances[accId]),
      physical_cash: '',
      cash_difference: '',
      closing_status: '',
      cash_on_hand_status: 'OK',
      receipt_url: opts.noReceipt ? '' : `https://drive.example.com/nota-pc/${id}.jpg`,
      urgent_flag: opts.urgent ? 'true' : 'false',
      approval_status: opts.approval ?? 'APPROVED',
      approved_by: (opts.approval ?? 'APPROVED') === 'APPROVED' ? 'USR-001' : '',
      notes: '',
      source_module: 'petty_cash',
      source_transaction_id: '',
      payment_source: '',
      linked_expense_id: opts.linkedExpenseId ?? '',
      linked_supplier_invoice_id: opts.linkedSupplierInvoiceId ?? '',
      created_by: 'USR-002',
      created_at: t
    });
  }

  for (let i = 0; i < OUTLETS.length; i++) {
    addPetty({ day: 13, outletIdx: i, desc: 'Saldo awal kas kecil', debit: 1000000, category: 'Top Up' });
    addPetty({ day: 11, outletIdx: i, desc: 'Beli gas & air galon', credit: 120000 + Math.round(rnd() * 80000), category: 'Gas' });
    addPetty({ day: 8, outletIdx: i, desc: 'Top up mingguan', debit: 500000, category: 'Top Up' });
    addPetty({ day: 5, outletIdx: i, desc: 'Keperluan kebersihan', credit: 85000 + Math.round(rnd() * 60000), category: 'Operational' });
    addPetty({ day: 2, outletIdx: i, desc: 'Transport & parkir', credit: 60000 + Math.round(rnd() * 50000), category: 'Transport' });
  }
  // Petty over daily limit (6 hari lalu, OL-001): Rp650.000 > limit Rp500.000
  addPetty({ day: 6, outletIdx: 0, desc: 'Perbaikan kompor mendadak', credit: 650000, urgent: true, category: 'Maintenance' });
  // Satu PENDING approval (urgent, menunggu owner)
  addPetty({ day: 1, outletIdx: 2, desc: 'Konsumsi rapat urgent', credit: 280000, urgent: true, approval: 'PENDING', category: 'Operational Mendadak' });
  // Cross-link (Revisi #4): kas kecil dipakai membayar expense (expense = primary)
  addPetty({ day: 4, outletIdx: 1, desc: 'Bayar internet via kas kecil', credit: 350000, linkedExpenseId: 'EXP-LINK-2', category: 'Internet' });
  // Cross-link: kas kecil dipakai membayar invoice supplier (supplier cost = primary)
  petty.push({
    petty_id: 'PC-LINK-1', date: dateOffset(3), brand_id: 'BR-001', brand_name: 'Funkydak',
    outlet_id: 'OL-001', outlet_name: 'Funkydak Cipete', account_id: 'PCA-001',
    description: 'Bayar invoice box kemasan (SUPC via kas kecil)', category: 'Packaging',
    qty: '1', unit: 'item', debit_topup: '0', credit_out: '450000',
    running_balance: String((balances['PCA-001'] = (balances['PCA-001'] ?? 0) - 450000)),
    physical_cash: '', cash_difference: '', closing_status: '', cash_on_hand_status: 'OK',
    receipt_url: 'https://drive.example.com/nota-pc/PC-LINK-1.jpg', urgent_flag: 'false',
    approval_status: 'APPROVED', approved_by: 'USR-001', notes: '',
    source_module: 'petty_cash', source_transaction_id: '', payment_source: '',
    linked_expense_id: '', linked_supplier_invoice_id: paidViaPettyId,
    created_by: 'USR-002', created_at: t
  });

  // Closing harian kas kecil per akun (Revisi #7) — hari ini, fisik cocok kecuali OL-004 selisih 25rb
  for (let i = 0; i < OUTLETS.length; i++) {
    const accId = `PCA-${String(i + 1).padStart(3, '0')}`;
    const bal = balances[accId] ?? 0;
    const mismatch = i === 3 ? -25000 : 0;
    const o = OUTLETS[i];
    petty.push({
      petty_id: `PC-CLOSE-${String(i + 1).padStart(3, '0')}`,
      date: dateOffset(0),
      brand_id: o.brand,
      brand_name: brandName(o.brand),
      outlet_id: o.id,
      outlet_name: o.name,
      account_id: accId,
      description: 'Closing kas kecil harian',
      category: 'Closing',
      qty: '1', unit: 'item', debit_topup: '0', credit_out: '0',
      running_balance: String(bal),
      physical_cash: String(bal + mismatch),
      cash_difference: String(mismatch),
      closing_status: mismatch === 0 ? 'CLOSED' : 'OPEN',
      cash_on_hand_status: mismatch === 0 ? 'OK' : 'MISMATCH',
      receipt_url: '', urgent_flag: 'false', approval_status: 'APPROVED', approved_by: 'USR-001',
      notes: '', source_module: 'petty_cash', source_transaction_id: '', payment_source: '',
      linked_expense_id: '', linked_supplier_invoice_id: '',
      created_by: 'USR-002', created_at: t
    });
  }

  // ── Expense log ───────────────────────────────────────────────
  const expenses: Record<string, string>[] = [];
  let expSeq = 1;
  function addExpense(opts: {
    day: number; outletIdx: number; category: string; desc: string; amount: number;
    method?: string; approval?: string; status?: string; idOverride?: string; noReceipt?: boolean;
  }): void {
    const o = OUTLETS[opts.outletIdx];
    const id = opts.idOverride ?? `EXP-${String(expSeq++).padStart(4, '0')}`;
    expenses.push({
      expense_id: id,
      date: dateOffset(opts.day),
      brand_id: o.brand,
      brand_name: brandName(o.brand),
      outlet_id: o.id,
      outlet_name: o.name,
      expense_category: opts.category,
      description: opts.desc,
      amount: String(opts.amount),
      payment_method: opts.method ?? 'PM-TRANSFER',
      receipt_url: opts.noReceipt ? '' : `https://drive.example.com/nota-exp/${id}.jpg`,
      approval_status: opts.approval ?? 'APPROVED',
      approved_by: (opts.approval ?? 'APPROVED') === 'APPROVED' ? 'USR-001' : '',
      status: opts.status ?? 'ACTIVE',
      notes: '',
      source_module: 'expense',
      source_transaction_id: '',
      payment_source: '',
      linked_supplier_invoice_id: '',
      linked_petty_cash_id: '',
      created_by: 'USR-002',
      created_at: t,
      updated_at: t
    });
  }

  addExpense({ day: 13, outletIdx: 0, category: 'Sewa', desc: 'Sewa ruko Juli (proporsi harian)', amount: 3000000 });
  addExpense({ day: 13, outletIdx: 2, category: 'Listrik', desc: 'Token listrik', amount: 750000, method: 'PM-CASH' });
  addExpense({ day: 12, outletIdx: 1, category: 'Internet', desc: 'Internet bulanan', amount: 450000 });
  addExpense({ day: 12, outletIdx: 5, category: 'Marketing', desc: 'Ads Instagram', amount: 500000 });
  addExpense({ day: 11, outletIdx: 0, category: 'Gaji', desc: 'Gaji mingguan kasir', amount: 1400000 });
  addExpense({ day: 10, outletIdx: 4, category: 'Air', desc: 'PDAM', amount: 280000 });
  addExpense({ day: 9, outletIdx: 6, category: 'Gas', desc: 'Gas LPG dapur', amount: 320000, method: 'PM-CASH' });
  addExpense({ day: 8, outletIdx: 0, category: 'Maintenance', desc: 'Servis AC', amount: 650000, noReceipt: true });
  addExpense({ day: 7, outletIdx: 3, category: 'Transport', desc: 'Distribusi antar outlet', amount: 400000 });
  addExpense({ day: 6, outletIdx: 0, category: 'Packaging', desc: 'Kantong & box tambahan', amount: 300000, method: 'PM-CASH' });
  addExpense({ day: 5, outletIdx: 2, category: 'Marketing', desc: 'Banner promo', amount: 350000 });
  addExpense({ day: 4, outletIdx: 1, category: 'Peralatan', desc: 'Termometer dapur', amount: 275000 });
  // Expense spike day (2 hari lalu, OL-003): 3× rata-rata → EXPENSE_SPIKE
  addExpense({ day: 2, outletIdx: 2, category: 'Operational Mendadak', desc: 'Perbaikan freezer mendadak', amount: 2400000 });
  addExpense({ day: 2, outletIdx: 0, category: 'Diskon', desc: 'Program diskon member', amount: 180000, approval: 'PENDING' });
  addExpense({ day: 1, outletIdx: 0, category: 'Transport', desc: 'Bensin kurir', amount: 150000, method: 'PM-CASH' });
  addExpense({ day: 1, outletIdx: 6, category: 'Other', desc: 'Materai & administrasi', amount: 90000, status: 'CANCELLED', approval: 'CANCELLED' });
  addExpense({ day: 0, outletIdx: 0, category: 'Listrik', desc: 'Token listrik mingguan', amount: 500000, method: 'PM-CASH' });
  addExpense({ day: 0, outletIdx: 3, category: 'Other', desc: 'Biaya tak terduga (ditolak)', amount: 999000, approval: 'REJECTED' });
  // Cross-link rows (primary side)
  addExpense({ day: 5, outletIdx: 2, category: 'Bahan Baku' as string, desc: 'Sayur urgent (terhubung ke invoice supplier)', amount: 320000, idOverride: 'EXP-LINK-1', method: 'PM-CASH' });
  addExpense({ day: 4, outletIdx: 1, category: 'Internet', desc: 'Internet dibayar via kas kecil', amount: 350000, idOverride: 'EXP-LINK-2' });

  // ── Closing cash: 7 outlets × 14 hari ─────────────────────────
  const closing: Record<string, string>[] = [];
  let closeSeq = 1;
  const prevPhysical: Record<string, number> = {};
  for (let day = 13; day >= 0; day--) {
    const date = dateOffset(day);
    for (const o of OUTLETS) {
      const opening = prevPhysical[o.id] ?? 500000;
      const posRow = pos.find((p) => p.date === date && p.outlet_id === o.id);
      const posCash = Number(posRow?.settle_cash ?? 0);
      const cashExpenseOut = expenses
        .filter((e) => e.date === date && e.outlet_id === o.id && e.payment_method === 'PM-CASH'
          && e.approval_status !== 'CANCELLED' && e.approval_status !== 'REJECTED')
        .reduce((s, e) => s + Number(e.amount), 0);
      const pettyOut = petty
        .filter((p) => p.date === date && p.outlet_id === o.id && Number(p.credit_out) > 0
          && !p.linked_expense_id && !p.linked_supplier_invoice_id)
        .reduce((s, p) => s + Number(p.credit_out), 0);
      const expected = opening + posCash - cashExpenseOut - pettyOut;
      // Cash diff day: OL-002 fisik kurang Rp75.000
      const mismatch = day === 4 && o.id === 'OL-002' ? -75000 : 0;
      const physical = expected + mismatch;
      prevPhysical[o.id] = physical;
      closing.push({
        closing_id: `CLS-${String(closeSeq++).padStart(4, '0')}`,
        date,
        brand_id: o.brand,
        outlet_id: o.id,
        outlet_name: o.name,
        opening_cash: String(opening),
        pos_cash_sales: String(posCash),
        cash_revenue_in: String(posCash),
        cash_expense_out: String(cashExpenseOut),
        petty_cash_out: String(pettyOut),
        expected_cash: String(expected),
        physical_cash: String(physical),
        cash_difference: String(mismatch),
        notes: mismatch !== 0 ? 'Selisih kas — investigasi kasir shift malam' : '',
        recorded_by: 'USR-002',
        created_at: t
      });
    }
  }

  // ── Threshold config (Revisi #10) ─────────────────────────────
  const thresholds: Record<string, string>[] = [
    ['THR-001', 'cash_difference_warning', 'Peringatan Selisih Kas', 'Alert HIGH jika selisih kas fisik vs sistem sama atau lebih dari nilai ini.', '50000', 'IDR', 'HIGH', 'GLOBAL', '', ''],
    ['THR-002', 'cash_difference_critical', 'Selisih Kas Kritis', 'Alert CRITICAL untuk selisih kas sangat besar. Wajib audit.', '200000', 'IDR', 'CRITICAL', 'GLOBAL', '', ''],
    ['THR-003', 'supplier_overdue_days_warning', 'Supplier Jatuh Tempo', 'Alert MEDIUM jika ada invoice supplier lewat jatuh tempo lebih dari N hari.', '7', 'hari', 'MEDIUM', 'GLOBAL', '', ''],
    ['THR-004', 'supplier_overdue_days_critical', 'Supplier Overdue Kritis', 'Alert HIGH jika invoice supplier lewat jatuh tempo lebih dari N hari. Risiko supply stop.', '14', 'hari', 'HIGH', 'GLOBAL', '', ''],
    ['THR-005', 'petty_cash_daily_limit', 'Limit Kas Kecil Harian', 'Alert MEDIUM jika total pengeluaran kas kecil per outlet per hari melebihi nilai ini.', '500000', 'IDR', 'MEDIUM', 'GLOBAL', '', ''],
    ['THR-006', 'expense_spike_pct', 'Lonjakan Expense vs Rata-rata 7 Hari', 'Alert MEDIUM jika total expense hari ini naik lebih dari N persen dibanding rata-rata 7 hari sebelumnya.', '20', '%', 'MEDIUM', 'GLOBAL', '', ''],
    ['THR-007', 'supplier_cost_spike_pct', 'Kenaikan Biaya Supplier Mingguan', 'Alert MEDIUM/HIGH jika total pembelian supplier minggu ini naik lebih dari N persen dibanding minggu sebelumnya.', '15', '%', 'MEDIUM', 'GLOBAL', '', ''],
    ['THR-008', 'refund_void_pct_warning', 'Refund/Void Tinggi', 'Alert MEDIUM jika (refund + void) mencapai N persen dari gross sales hari ini.', '5', '%', 'MEDIUM', 'GLOBAL', '', ''],
    ['THR-009', 'refund_void_pct_high', 'Refund/Void Kritis', 'Alert HIGH jika (refund + void) mencapai N persen dari gross sales hari ini.', '10', '%', 'HIGH', 'GLOBAL', '', ''],
    ['THR-010', 'settlement_mismatch_tolerance', 'Toleransi Selisih Settlement POS', 'Alert MEDIUM jika total settlement per metode pembayaran tidak cocok dengan net sales melebihi nilai ini.', '10000', 'IDR', 'MEDIUM', 'GLOBAL', '', ''],
    ['THR-011', 'missing_receipt_min_amount', 'Minimal Nota Wajib Ada', 'Alert LOW untuk transaksi tanpa nota/bukti dengan nilai sama atau lebih dari ini.', '100000', 'IDR', 'LOW', 'GLOBAL', '', '']
  ].map(([id, key, label, explanation, value, unit, severity, scope, brandId, outletId]) => ({
    threshold_id: id, key, label, explanation, value, unit, severity,
    scope, brand_id: brandId, outlet_id: outletId, active: 'true',
    last_changed: t, changed_by: 'USR-001'
  }));
  // Contoh override scope brand (Revisi #10: bisa berbeda per brand/outlet)
  thresholds.push({
    threshold_id: 'THR-012', key: 'supplier_overdue_days_warning',
    label: 'Supplier Jatuh Tempo — Funkydak', explanation: 'Override brand Funkydak: alert lebih awal di 5 hari.',
    value: '5', unit: 'hari', severity: 'MEDIUM', scope: 'BRAND', brand_id: 'BR-001', outlet_id: '',
    active: 'true', last_changed: t, changed_by: 'USR-001'
  });

  // hr_payroll (data HR V1 — dibaca read-only oleh Beban Gaji)
  const payPeriods = [0, 1].map((back) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - back, 1);
    return d.toISOString().slice(0, 7);
  });
  const EMP = [
    ['EMP-00001', 'Andi Saputra', 'BR-001', 'OL-001', 3_200_000],
    ['EMP-00002', 'Budi Santoso', 'BR-001', 'OL-002', 2_900_000],
    ['EMP-00003', 'Citra Lestari', 'BR-002', 'OL-003', 3_000_000],
    ['EMP-00004', 'Dewi Anggraini', 'BR-002', 'OL-004', 2_800_000],
    ['EMP-00005', 'Eko Prasetyo', 'BR-003', 'OL-005', 2_700_000],
    ['EMP-00006', 'Fitri Handayani', 'BR-004', 'OL-006', 2_600_000],
    ['EMP-00007', 'Gilang Ramadhan', 'BR-005', 'OL-007', 2_750_000]
  ] as const;
  const payrolls: Record<string, string>[] = [];
  payPeriods.forEach((period, pi) => {
    EMP.forEach(([empId, name, brandId, outletId, basic], ei) => {
      const overtime = Math.round((rnd() * 8 + 2)) * 15_000;
      const bonus = pi === 0 && ei % 3 === 0 ? 250_000 : 0;
      const gross = basic + overtime + bonus;
      const bpjs = Math.round(basic * 0.03 / 1000) * 1000;
      const net = gross - bpjs;
      const paymentStatus = pi === 1 ? 'PAID' : ei < 2 ? 'PAID' : 'UNPAID';
      payrolls.push({
        payroll_id: `PR-${empId}-${period}`,
        payroll_period: period,
        employee_id: empId,
        employee_name: name,
        brand_id: brandId,
        outlet_id: outletId,
        basic_salary: String(basic),
        attendance_deduction: '0',
        overtime_pay: String(overtime),
        bonus_total: String(bonus),
        allowance_total: '0',
        penalty_total: '0',
        cash_advance_deduction: '0',
        bpjs_deduction: String(bpjs),
        tax_deduction: '0',
        gross_salary: String(gross),
        net_salary: String(net),
        calculation_status: 'OK',
        approval_status: 'APPROVED',
        payment_status: paymentStatus,
        payment_date: paymentStatus === 'PAID' ? `${period}-28` : '',
        finance_notified_at: '',
        finance_notified_by: '',
        email_sent_at: '',
        email_sent_to: '',
        email_sent_status: '',
        created_at: t,
        updated_at: t
      });
    });
  });

  return {
    [TAB.brands]: BRANDS.map(([id, name, code, email]) => ({
      brand_id: id, brand_name: name, brand_code: code, email: email ?? '', status: 'active', created_at: t, updated_at: t
    })),
    [TAB.outlets]: OUTLETS.map((o) => ({
      outlet_id: o.id, brand_id: o.brand, outlet_name: o.name, outlet_code: o.code,
      address: o.name, status: 'active', created_at: t, updated_at: t
    })),
    [TAB.suppliers]: SUPPLIERS.map(([id, name, cat], i) => ({
      supplier_id: id, supplier_name: name, category: cat,
      phone: `081234000${String(i + 1).padStart(3, '0')}`,
      bank_name: i % 2 === 0 ? 'BCA' : 'Mandiri',
      bank_account: `1234567${String(i + 1).padStart(3, '0')}`,
      account_holder: name,
      status: 'active', created_at: t, updated_at: t
    })),
    [TAB.expenseCategories]: EXPENSE_CATEGORIES.map((name, i) => ({
      category_id: `CAT-${String(i + 1).padStart(3, '0')}`,
      category_name: name,
      account_type: name === 'Sewa' || name === 'Peralatan' ? 'CAPEX' : 'OPEX',
      status: 'active', created_at: t
    })),
    [TAB.paymentMethods]: [
      { method_id: 'PM-CASH', method_name: 'Cash', type: 'cash', is_cash: 'true', status: 'active', created_at: t },
      { method_id: 'PM-QRIS', method_name: 'QRIS', type: 'ewallet', is_cash: 'false', status: 'active', created_at: t },
      { method_id: 'PM-CARD', method_name: 'Kartu Debit/Kredit', type: 'card', is_cash: 'false', status: 'active', created_at: t },
      { method_id: 'PM-TRANSFER', method_name: 'Transfer Bank', type: 'transfer', is_cash: 'false', status: 'active', created_at: t },
      { method_id: 'PM-MARKETPLACE', method_name: 'Marketplace (GoFood/GrabFood/ShopeeFood)', type: 'marketplace', is_cash: 'false', status: 'active', created_at: t }
    ],
    [TAB.pettyCashAccounts]: OUTLETS.map((o, i) => ({
      account_id: `PCA-${String(i + 1).padStart(3, '0')}`,
      outlet_id: o.id,
      brand_id: o.brand,
      account_name: `Kas Kecil ${o.name}`,
      opening_balance: '1000000',
      daily_limit: '500000',
      currency: 'IDR',
      status: 'active',
      created_at: t
    })),
    [TAB.posDaily]: pos,
    [TAB.supplierCost]: supCosts,
    [TAB.pettyCash]: petty,
    [TAB.expense]: expenses,
    [TAB.closingCash]: closing,
    [TAB.payroll]: payrolls,
    // Output tabs diisi oleh /api/finance/summary/regenerate
    [TAB.dailySummary]: [],
    [TAB.alertLog]: [],
    [TAB.actionTracker]: [],
    [TAB.thresholdConfig]: thresholds,
    [TAB.users]: [
      { user_id: 'USR-001', username: 'owner', password_hash: pwOwner, role: 'owner', brand_id: '', outlet_id: '', active_status: 'active', created_at: t, last_login_at: '' },
      { user_id: 'USR-002', username: 'finance', password_hash: pwFinance, role: 'finance_admin', brand_id: '', outlet_id: '', active_status: 'active', created_at: t, last_login_at: '' }
    ],
    [TAB.auditLog]: [],
    [TAB.telegramDeliveryLog]: []
  };
}

// Dev-mode (Turbopack) gives each route-handler bundle its own module graph,
// so a module-level `let store` is NOT shared between routes (e.g. /regenerate
// writes don't appear in /count). Hoist onto globalThis so all graphs in this
// Node process share ONE store. Keyed per-app to avoid collisions.
const SEED_VERSION = 4; // bump when seed() data changes to force a clean re-seed
const GLOBAL_KEY = `__YKP_FINANCE_MOCK_STORE_V${SEED_VERSION}__`;
const g = globalThis as unknown as Record<string, Record<string, Record<string, string>[]> | undefined>;
function getStore() {
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = seed();
  return g[GLOBAL_KEY]!;
}

export function isMockMode(): boolean {
  if (process.env.USE_MOCK_DB === 'true') return true;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) return true;
  if (!process.env.YKP_FINANCE_SPREADSHEET_ID) return true;
  return false;
}

export function mockReadTab(tab: string): Record<string, string>[] {
  return [...(getStore()[tab] ?? [])];
}

export function mockAppendRows(tab: string, rows: Record<string, string>[]): number {
  const s = getStore();
  if (!s[tab]) s[tab] = [];
  const start = s[tab].length + 2;
  s[tab].push(...rows.map((r) => ({ ...r })));
  return start;
}

export function mockUpdateRow(tab: string, rowNumber: number, values: Record<string, string>): void {
  const s = getStore();
  const idx = rowNumber - 2;
  if (idx < 0 || !s[tab]?.[idx]) throw new Error(`mock row ${rowNumber} not found in ${tab}`);
  s[tab][idx] = { ...s[tab][idx], ...values };
}

export function mockFindRow(
  tab: string,
  keyCol: string,
  value: string
): { rowNumber: number; row: Record<string, string> } | null {
  const rows = getStore()[tab] ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][keyCol] === value) return { rowNumber: i + 2, row: { ...rows[i] } };
  }
  return null;
}
