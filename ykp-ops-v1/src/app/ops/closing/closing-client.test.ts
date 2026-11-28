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
  it('shows brand accent, PIC and "Sebelum tutup" framing', () => {
    const html = renderToStaticMarkup(React.createElement(ClosingClient, { ...props, picName: 'Sari' }));
    expect(html).toContain('#E01020');
    expect(html).toContain('PIC checklist: Sari');
    expect(html).toContain('Sebelum tutup');
  });
  it('shows brand/outlet/tanggal context and per-division start', () => {
    const html = renderToStaticMarkup(React.createElement(ClosingClient, {
      ...props,
      outlets: [{ outlet_id: 'OL1', outlet_name: 'Garuda', brand_id: 'BR1' }],
      brands: [{ brand_id: 'BR1', brand_name: 'Funkydak' }],
      date: '2026-12-11',
      templates: [{ checklist_template_id: 'T9', brand_id: 'BR1', outlet_id: 'OL1', checklist_type: 'CLOSING', department: 'Kasir', checklist_item: 'Rekonsiliasi kas', active_status: 'active' }]
    }));
    expect(html).toContain('Draf untuk Funkydak - Garuda');
    expect(html).toContain('Belum dimulai');
    expect(html).toContain('Mulai checklist Kasir');
  });
});
