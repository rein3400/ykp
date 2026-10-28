import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import GuidePage from './page';
describe('Owner user guide', () => {
 it('explains source-data limitations with working module links', () => {
  const html = renderToStaticMarkup(React.createElement(GuidePage));
  for (const text of ['Panduan Pengguna', 'read-only', 'Data tidak tersedia', 'Penting:']) expect(html).toContain(text);
  for (const match of html.matchAll(/href="(\/[^"]*)"/g)) expect(existsSync(join(process.cwd(), 'src/app', match[1], 'page.tsx')), match[1]).toBe(true);
 });
});
