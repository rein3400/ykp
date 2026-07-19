/**
 * Seed default owner user. Run: npm run sheets:seed-user
 * Note: change default password before pilot.
 */
import { getSheetsClient, getSpreadsheetId, TABS } from '../src/db/sheets';
import { nowTimestampWib } from '../src/lib/format';
import bcrypt from 'bcryptjs';

async function main(): Promise<void> {
  const sheets = getSheetsClient();
  const sid = getSpreadsheetId();
  const tab = TABS.users;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${tab}!A2:A2`
  });
  if (res.data.values?.[0]?.[0]) {
    console.log('users tab already seeded');
    return;
  }
  const pw = bcrypt.hashSync('owner123', 10);
  const row = [
    'USR-001', 'owner', pw, 'owner', '', '', 'active', nowTimestampWib(), ''
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sid,
    range: `${tab}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
  console.log('seeded owner/owner123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
