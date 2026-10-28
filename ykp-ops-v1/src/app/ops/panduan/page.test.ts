import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import GuidePage from './page';
describe('Ops user guide', () => {
 it('documents actual bot and checklist capabilities with working links', () => {
  const html = renderToStaticMarkup(React.createElement(GuidePage));
  for (const text of ['Panduan Pengguna', '@ykp_operasional_bot', 'belum seluruhnya', 'template CLOSING', 'Penting:']) expect(html).toContain(text);
  for (const match of html.matchAll(/href="(\/[^"]*)"/g)) expect(existsSync(join(process.cwd(), 'src/app', match[1], 'page.tsx')), match[1]).toBe(true);
 });
});
