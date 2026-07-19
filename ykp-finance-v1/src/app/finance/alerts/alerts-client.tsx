'use client';
/**
 * Finance Alert Log — output rules engine (brief §11). Acknowledge/resolve
 * manual (Hermez never auto-resolves).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { can, type Role } from '@/lib/rbac';
import { Card, EmptyState, Btn, Th, Td, Badge, Select } from '../ui';

export default function AlertsClient({ alerts, role }: { alerts: Record<string, string>[]; role: string }) {
  const router = useRouter();
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const canUpdate = can(role as Role, 'update', 'alert');

  const rows = useMemo(() => alerts
    .filter((a) => (!severity || a.severity === severity) && (!status || a.status === status))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
  [alerts, severity, status]);

  async function setStatusFor(id: string, s: string) {
    try {
      const r = await fetch(`/api/finance/alerts/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s })
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error?.message ?? 'Gagal'); return; }
      toast.success(`Alert ${s.toLowerCase()}`);
      router.refresh();
    } catch { toast.error('Network error'); }
  }

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>Finance Alerts</h1>
        <p className='text-sm text-muted-foreground'>
          Dibuat otomatis saat regenerate laporan harian. HIGH/CRITICAL otomatis membuat action di Action Tracker.
        </p>
      </div>

      <div className='flex gap-2 rounded border border-border bg-background p-2'>
        <div className='w-40'>
          <Select label='Severity' value={severity} onChange={setSeverity}>
            <option value=''>Semua</option>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        <div className='w-40'>
          <Select label='Status' value={status} onChange={setStatus}>
            <option value=''>Semua</option>
            {['OPEN', 'ACK', 'RESOLVED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={'Belum ada alert.\nGenerate laporan harian untuk menjalankan finance rules engine.'} />
      ) : (
        <Card title={`Alert Log (${rows.length})`}>
          <div className='overflow-x-auto'>
            <table className='w-full text-xs'>
              <thead className='bg-muted text-muted-foreground'>
                <tr>
                  <Th>Tanggal</Th><Th>Outlet</Th><Th>Tipe</Th><Th>Pesan</Th>
                  <Th>Severity</Th><Th>Status</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.alert_id} className='border-t border-border'>
                    <Td muted>{a.date}</Td>
                    <Td>{a.outlet}</Td>
                    <Td muted>{a.alert_type}</Td>
                    <Td>{a.message}</Td>
                    <Td><Badge value={a.severity} /></Td>
                    <Td><Badge value={a.status} /></Td>
                    <Td>
                      {canUpdate && a.status !== 'RESOLVED' && (
                        <div className='flex gap-1'>
                          {a.status === 'OPEN' && <Btn variant='ghost' onClick={() => setStatusFor(a.alert_id, 'ACK')}>ack</Btn>}
                          <Btn variant='outline' onClick={() => setStatusFor(a.alert_id, 'RESOLVED')}>resolve</Btn>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
