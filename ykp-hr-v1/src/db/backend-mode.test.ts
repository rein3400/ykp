import { afterEach, describe, expect, it, vi } from 'vitest';
import { isMockMode } from './mock-store';
afterEach(() => vi.unstubAllEnvs());
describe('backend provenance', () => {
  it('never selects mock in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('USE_MOCK_DB', 'true');
    expect(isMockMode()).toBe(false);
  });
  it('does not shadow selected Postgres with mock', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('USE_POSTGRES', 'true');
    vi.stubEnv('USE_MOCK_DB', 'true');
    expect(isMockMode()).toBe(false);
  });
});
