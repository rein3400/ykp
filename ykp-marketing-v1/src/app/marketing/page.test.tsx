import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketingDashboard } from '@/components/marketing-dashboard';

describe('Marketing page', () => {
  const html = renderToStaticMarkup(React.createElement(MarketingDashboard));

  it('shows Panduan Meta and Arahan Konten on the same page, Meta above', () => {
    expect(html).toContain('Panduan Meta');
    expect(html).toContain('Arahan Konten');
    expect(html.indexOf('id="panduan-meta"')).toBeLessThan(
      html.indexOf('id="arahan-konten-title"')
    );
  });

  it('includes honest disclaimers and provenance', () => {
    expect(html).toContain('Hasil FYP tidak dijanjikan');
    expect(html).toContain('Referensi nyata');
    expect(html).toContain('bukti terbatas');
    expect(html).toContain('Posting asli');
    expect(html).toContain('Metadata dicek');
  });

  it('keeps the local preview label and brands', () => {
    expect(html).toContain('PREVIEW LOKAL');
    expect(html).toContain('Funkydak');
    expect(html).toContain('Content Planner');
  });
});
