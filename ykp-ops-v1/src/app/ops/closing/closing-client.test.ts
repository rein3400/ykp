import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClosingClient } from './closing-client';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
const props = {
  date: '2026-10-10',
  outlets: [{ outlet_id: 'OL1', outlet_name: 'Suburbun', brand_id: 'BR1' }],
  shifts: [{ shift_id: 'S1', shift_name: 'Malam' }],
  templates: [{ checklist_template_id: 'T1', checklist_type: 'CLOSING', active_status: 'active', outlet_id: 'OL1', brand_id: 'BR1', department: 'Kitchen', checklist_item: 'Matikan kompor', critical_flag: 'true' }],
  rows: [{ closing_id: 'C1', date: '2026-10-09', outlet_id: 'OL1', shift_id: 'S1', status: 'CLOSED', closed_by: 'U1' }]
};
describe('Closing presentation', () => {
  it('shows real progress, department heading, labeled controls and readable history', () => {
    const html = renderToStaticMarkup(React.createElement(ClosingClient, props));
    expect(html).toContain('0 dari 1');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Kitchen');
    expect(html).toContain('Kritikal');
    expect(html).toContain('Selesai');
    expect(html).toContain('Suburbun');
    expect(html).toContain('Malam');
    expect(html).toContain('Catatan &amp; bukti');
  });
  it('has explicit empty states instead of fabricated progress or history', () => {
    const html = renderToStaticMarkup(React.createElement(ClosingClient, { ...props, templates: [], rows: [] }));
    expect(html).toContain('Template belum tersedia');
    expect(html).toContain('Belum ada riwayat closing');
  });
});
