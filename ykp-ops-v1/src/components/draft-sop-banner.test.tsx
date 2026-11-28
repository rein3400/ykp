import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DraftSopBanner } from './draft-sop-banner';

describe('DraftSopBanner', () => {
  it('shows the draft badge and SOP disclaimer', () => {
    const html = renderToStaticMarkup(React.createElement(DraftSopBanner, {}));
    expect(html).toContain('Draf SOP');
    expect(html).toContain('SOP resmi tiap brand/outlet belum dilampirkan');
  });

  it('shows the draft context when provided', () => {
    const html = renderToStaticMarkup(React.createElement(DraftSopBanner, { context: 'Funkydak - Garuda' }));
    expect(html).toContain('Draf untuk Funkydak - Garuda');
  });
});
