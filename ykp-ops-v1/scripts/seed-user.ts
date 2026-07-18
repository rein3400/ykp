/**
 * Seed default owner user. Run after bootstrap.
 * Default: owner / owner123
 */
import { createHash } from 'crypto';
import { appendRows, TABS } from '../src/db/sheets';

async function main() {
  const pw = createHash('sha256').update('owner123').digest('hex');
  await appendRows(TABS.users, [{
    user_id: 'USR-001',
    username: 'owner',
    password_hash: pw,
    role: 'owner',
    brand_id: '',
    outlet_id: '',
    active_status: 'active',
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    last_login_at: '',
  }]);
  console.log('seed user owner / owner123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
