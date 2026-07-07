import { readTab, TABS } from '@/db/sheets';
import { SummaryControls } from '@/features/hr/components/summary-controls';

export const dynamic = 'force-dynamic';

interface Summary {
  summary_id: string;
  date: string;
  brand_id: string;
  brand_name: string;
  outlet_id: string;
  outlet_name: string;
  staff_present: string;
  staff_late: string;
  staff_absent: string;
  total_late_minutes: string;
  major_hr_issue: string;
  recommended_action: string;
  alert_level: string;
}

export default async function SummaryPage() {
  const rows = await readTab<Summary>(TABS.dailySummary);
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>HR Daily Summary</h1>
        <p className='text-sm text-muted-foreground'>
          Summary agregat harian. Data ini dibaca oleh Hermez (read-only). Tidak ada PII.
        </p>
      </div>

      <SummaryControls />

      {sorted.length === 0 ? (
        <div className='card py-8 text-center text-sm text-muted-foreground'>
          Belum ada summary. Klik Regenerate di atas.
        </div>
      ) : (
        <div className='grid gap-3'>
          {sorted.map((r) => (
            <div key={r.summary_id} className='card space-y-1'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='font-semibold'>{r.brand_name || r.brand_id} — {r.outlet_name || r.outlet_id}</div>
                  <div className='text-xs text-muted-foreground'>{r.date}</div>
                </div>
                <span className={
                  r.alert_level === 'red' ? 'badge-red' :
                  r.alert_level === 'yellow' ? 'badge-yellow' : 'badge-green'
                }>
                  {r.alert_level || 'green'}
                </span>
              </div>
              <div className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-4'>
                <div><span className='text-muted-foreground'>Present:</span> {r.staff_present}</div>
                <div><span className='text-muted-foreground'>Late:</span> {r.staff_late}</div>
                <div><span className='text-muted-foreground'>Absent:</span> {r.staff_absent}</div>
                <div><span className='text-muted-foreground'>Late (m):</span> {r.total_late_minutes}</div>
              </div>
              {r.major_hr_issue && <div className='text-sm text-yellow-700'>Issue: {r.major_hr_issue}</div>}
              {r.recommended_action && <div className='text-sm text-muted-foreground'>Action: {r.recommended_action}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}