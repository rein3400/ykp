import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import GuidePage from './page';
describe('user guide', () => {
  it('renders task steps, limitations and links to existing module pages', () => {
    const html = renderToStaticMarkup(React.createElement(GuidePage));
    expect(html).toContain('Panduan Pengguna');
    expect(html).toContain('Hasil yang diharapkan');
    expect(html).toContain('Penting:');
    expect(html).toContain('<ol');
    expect(html).toContain('<details');
    for (const match of html.matchAll(/href="(\/[^"]*)"/g)) {
      expect(existsSync(join(process.cwd(), 'src/app', match[1], 'page.tsx')), match[1]).toBe(true);
    }
    expect(html).not.toMatch(/password\s*[:=]\s*[^<\s]+/i);
  });
});
