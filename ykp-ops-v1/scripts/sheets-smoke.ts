/**
 * Smoke: read tabs in mock mode.
 *   npm run sheets:smoke
 */
import { mockReset } from '../src/db/mock-store';
import { readTab, TABS } from '../src/db/sheets';

async function main() {
  process.env.USE_MOCK_DB = 'true';
  mockReset();
  const brands = await readTab(TABS.brands);
  const outlets = await readTab(TABS.outlets);
  const users = await readTab(TABS.users);
  console.log('smoke OK', { brands: brands.length, outlets: outlets.length, users: users.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
