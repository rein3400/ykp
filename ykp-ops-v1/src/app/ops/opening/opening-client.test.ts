import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OpeningClient } from './opening-client';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
describe('Opening presentation', () => {
  it('shows accessible progress, grouped tasks and details matching Closing', () => {
    const html = renderToStaticMarkup(React.createElement(OpeningClient, {
      outlets: [{ outlet_id: 'OL1', outlet_name: 'Suburbun', brand_id: 'BR1' }],
      shifts: [{ shift_id: 'S1', shift_name: 'Pagi' }], rows: [],
      templates: [{ checklist_template_id: 'T1', outlet_id: 'OL1', brand_id: 'BR1', checklist_type: 'OPENING', active_status: 'active', department: 'FOH', checklist_item: 'Cek POS' }]
    }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('0 dari 1');
    expect(html).toContain('Catatan &amp; bukti');
    expect(html).toContain('FOH');
    expect(html).toContain('Suburbun');
    expect(html).toContain('Belum ada riwayat opening');
  });
});
