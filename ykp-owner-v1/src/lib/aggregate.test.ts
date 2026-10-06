import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOverview } from './aggregate';
vi.mock('./fetch', async (original) => ({
  ...await original<typeof import('./fetch')>(),
  fetchJson: vi.fn(async () => ({ ok: false, latencyMs: 1, error: 'Unavailable', data: null }))
}));
afterEach(() => vi.unstubAllEnvs());
describe('production overview provenance', () => {
  it('does not invent mock rows when every upstream is down, even with mock flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('YKP_OWNER_MOCK', 'true');
    const result = await getOverview();
    expect(result.mock).toBe(false);
    expect(Object.values(result.modules).every((module) => !module.reachable && module.rows.length === 0)).toBe(true);
  });
});
