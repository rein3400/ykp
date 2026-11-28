import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('brand tokens', () => {
  it('defines exact brand/ink CSS tokens', () => {
    const css = read('src/app/globals.css');
    expect(css).toMatch(/--brand:\s*355 85% 47%/);
    expect(css).toMatch(/--ink:\s*0 0% 6%/);
    expect(css).toMatch(/--brand-strong:/);
  });

  it('exposes brand + ink in tailwind', () => {
    const tw = read('tailwind.config.ts');
    expect(tw).toMatch(/brand/);
    expect(tw).toMatch(/ink/);
  });

  it('shell (layout) uses brand accent, no sky/blue/indigo', () => {
    const layout = read('src/app/ops/layout.tsx');
    expect(layout).not.toMatch(/sky-|blue-|indigo-/);
    expect(layout).toContain('#E01020');
  });

  it('sidebar exposes brand accent', () => {
    expect(read('src/components/sidebar.tsx')).toContain('#E01020');
  });
});
