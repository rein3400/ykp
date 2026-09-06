import { readTab, TABS } from '@/db/sheets';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import LegacyBanner from '@/components/legacy-banner';

export const dynamic = 'force-dynamic';

export default async function StokPage({ searchParams }: { searchParams: Promise<{ item_id?: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const sp = await searchParams;
  const itemId = sp.item_id;

  const [rows, items] = await Promise.all([
    readTab<Record<string, string>>(TABS.legacyKartuStok),
    readTab<Record<string, string>>(TABS.items)
  ]);

  const filtered = itemId ? rows.filter((r) => r.item_id === itemId) : rows;
  const sorted = [...filtered].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>F2 — Kartu Stok Gudang</h1>
        <p className='text-sm text-muted-foreground'>1 transaksi = 1 baris. Saldo terhitung otomatis. Cocokkan dengan fisik tiap closing.</p>
      </div>
      <LegacyBanner newFlow='Stock Ledger (immutable movement ledger) — menu Transaksi › Stock Ledger' />
      <form className='flex gap-2 text-xs'>
        <select name='item_id' aria-label='Filter berdasarkan item' defaultValue={itemId ?? ''} className='rounded border border-border px-2 py-1'>
          <option value=''>Semua Item</option>
          {items.map((i) => <option key={i.item_id} value={i.item_id}>{i.item_name}</option>)}
        </select>
        <button type='submit' className='rounded bg-primary px-3 py-1 font-medium text-primary-foreground'>Filter</button>
      </form>
      <div className='overflow-x-auto rounded border border-border'>
        <table className='w-full text-xs'>
          <thead className='bg-muted text-muted-foreground'>
            <tr>
              <th className='px-2 py-1 text-left'>Tanggal</th><th className='px-2 py-1 text-left'>Item</th>
              <th className='px-2 py-1 text-left'>Tipe</th><th className='px-2 py-1 text-right'>Masuk</th>
              <th className='px-2 py-1 text-right'>Keluar</th><th className='px-2 py-1 text-right'>Saldo</th>
              <th className='px-2 py-1 text-left'>Keterangan</th><th className='px-2 py-1 text-left'>PIC</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.stock_tx_id} className='border-t border-border'>
                <td className='px-2 py-1'>{r.date} {r.time}</td>
                <td className='px-2 py-1'>{r.item_name}</td>
                <td className='px-2 py-1'>{r.tx_type}</td>
                <td className='px-2 py-1 text-right text-success'>{r.qty_in || '-'}</td>
                <td className='px-2 py-1 text-right text-destructive'>{r.qty_out || '-'}</td>
                <td className='px-2 py-1 text-right font-medium'>{r.saldo}</td>
                <td className='px-2 py-1 text-muted-foreground'>{r.keterangan}</td>
                <td className='px-2 py-1'>{r.pic}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={8} className='px-2 py-3 text-center text-muted-foreground'>Belum ada transaksi stok.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}