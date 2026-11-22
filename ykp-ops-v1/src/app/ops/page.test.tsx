import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const session = { userId: 'U1', username: 'staff', role: 'staff', outletId: '' as string | undefined };
vi.mock('@/lib/session', () => ({ getSession: async () => session }));
vi.mock('@/db/sheets', () => ({
  TABS: new Proxy({}, { get: (_t, key) => String(key) }),
  readTab: async () => [],
  appendRows: async () => 2,
  updateRow: async () => undefined,
}));
vi.mock('@/lib/repo', () => ({ getBrandName: async () => 'B', getOutletName: async () => 'O' }));
vi.mock('next/navigation', () => ({
  redirect: () => { throw new Error('redirect'); },
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  usePathname: () => '/ops',
}));

const Page = (await import('./page')).default;

describe('ops scope notice', () => {
  it('tells a staff account without an outlet why the dashboard is empty', async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('belum terhubung ke outlet');
  });

  it('hides the notice once the outlet is assigned', async () => {
    session.outletId = 'OL-013';
    const html = renderToStaticMarkup(await Page());
    expect(html).not.toContain('belum terhubung ke outlet');
  });
});
