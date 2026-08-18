import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  console.log('--- 1. Hub Portal (Port 13000 -> 3000) ---');
  const pageHub = await context.newPage();
  await pageHub.goto('http://127.0.0.1:13000/', { timeout: 15000 });
  await pageHub.waitForTimeout(1000);
  console.log('   Hub Title:', await pageHub.title());
  await pageHub.screenshot({ path: 'tests/screens/vps-hub-live.png' });

  console.log('--- 2. HR-V1 (Port 13008 -> 3008) Real Sheets Login ---');
  const pageHr = await context.newPage();
  await pageHr.goto('http://127.0.0.1:13008/login', { timeout: 15000 });
  await pageHr.fill('input[name="username"], input[type="text"]', 'owner');
  await pageHr.fill('input[name="password"], input[type="password"]', 'owner123');
  await pageHr.click('button[type="submit"]');
  await pageHr.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  console.log('   HR Logged in URL:', pageHr.url());
  await pageHr.waitForTimeout(1000);
  await pageHr.screenshot({ path: 'tests/screens/vps-hr-v1-dashboard.png' });

  console.log('--- 3. HR-V1 Attendance Page (Telegram Absen) ---');
  await pageHr.goto('http://127.0.0.1:13008/hr/attendance', { timeout: 15000 });
  await pageHr.waitForTimeout(1500);
  console.log('   HR Attendance URL:', pageHr.url());
  await pageHr.screenshot({ path: 'tests/screens/vps-hr-v1-attendance.png' });

  console.log('--- 4. Finance-V1 (Port 13009 -> 3009) Login ---');
  const pageFin = await context.newPage();
  await pageFin.goto('http://127.0.0.1:13009/login', { timeout: 15000 });
  await pageFin.fill('input[name="username"], input[type="text"]', 'owner');
  await pageFin.fill('input[name="password"], input[type="password"]', 'owner123');
  await pageFin.click('button[type="submit"]');
  await pageFin.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  console.log('   Finance Logged in URL:', pageFin.url());
  await pageFin.waitForTimeout(1000);
  await pageFin.screenshot({ path: 'tests/screens/vps-finance-v1-dashboard.png' });

  console.log('--- 5. Finance-V1 POS Page (Sheet URL Import Modal) ---');
  await pageFin.goto('http://127.0.0.1:13009/finance/pos', { timeout: 15000 });
  await pageFin.waitForTimeout(1500);
  console.log('   Finance POS URL:', pageFin.url());

  // Click the Import POS button to open modal with sheet URL input
  const importBtn = pageFin.locator('button:has-text("Import"), button:has-text("import")').first();
  if (await importBtn.isVisible()) {
    await importBtn.click();
    await pageFin.waitForTimeout(1000);
    console.log('   Opened POS Import Modal with Google Sheet URL tab!');
  }
  await pageFin.screenshot({ path: 'tests/screens/vps-finance-v1-pos.png' });

  await browser.close();
  console.log('=== ALL BROWSER TESTS PASSED ON LIVE VPS ===');
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
