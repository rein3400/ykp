import { describe, it, expect } from 'vitest';
import { BRANDS, META_GUIDE_ITEMS, CONTENT_REFERENCES, DISCLAIMERS } from './marketing-preview';

describe('marketing preview data', () => {
  it('lists the five real YKP brands', () => {
    expect(BRANDS).toHaveLength(5);
    expect(BRANDS).toContain('Funkydak');
    expect(BRANDS).toContain('Sekar Pizza');
  });

  it('meta guide has items and the no-guarantee disclaimer', () => {
    expect(META_GUIDE_ITEMS.length).toBeGreaterThan(0);
    expect(DISCLAIMERS.meta).toContain('Hasil FYP tidak dijanjikan');
  });

  it('each reference carries provenance and limited evidence', () => {
    expect(CONTENT_REFERENCES.length).toBeGreaterThan(0);
    for (const ref of CONTENT_REFERENCES) {
      expect(ref.evidence).toBe('bukti terbatas');
      expect(ref.originalPostDate).toBeTruthy();
      expect(ref.metadataCheckedAt).toBeTruthy();
      expect(ref.performance).toBe('belum tersedia');
    }
  });
});
