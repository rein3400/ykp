import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import GuidePage from './page';
describe('Investor user guide', () => {
 it('explains read-only scope without promising investment results', () => {
  const html = renderToStaticMarkup(React.createElement(GuidePage));
  for (const text of ['Panduan Pengguna', 'read-only', 'bukan jaminan', 'Penting:']) expect(html).toContain(text);
  for (const match of html.matchAll(/href="(\/[^"]*)"/g)) expect(existsSync(join(process.cwd(), 'src/app', match[1], 'page.tsx')), match[1]).toBe(true);
 });
});
