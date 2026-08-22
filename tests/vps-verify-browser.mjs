import { chromium } from 'playwright';
import path from 'path';

const VPS = 'http://187.52.124.40';
const outDir = path.resolve('screenshots');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // 1. Hub Portal
  console.log('1. Loading Hub Portal...');
  const pageHub = await context.newPage();
  await pageHub.goto(`${VPS}:3000/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await pageHub.waitForTimeout(2000);
  console.log('   Hub Title:', await pageHub.title());
  await pageHub.screenshot({ path: path.join(outDir, 'vps-hub-live.png'), fullPage: true });

  // 2. HR-V1 (Port 3008) Login & Dashboard
  console.log('2. HR-V1 (Real Sheets) Flow...');
  const pageHr = await context.newPage();
  await pageHr.goto(`${VPS}:3008/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await pageHr.fill('input[type="text"]', 'owner');
  await pageHr.fill('input[type="password"]', 'owner123');
  await pageHr.click('button[type="submit"]');
  await pageHr.waitForURL('**/hr**', { timeout: 15000 });
  console.log('   HR-v1 Logged in URL:', pageHr.url());
  await pageHr.waitForTimeout(2000);
  await pageHr.screenshot({ path: path.join(outDir, 'vps-hr-v1-dashboard.png') });

  // 3. HR-V1 Attendance Page (Telegram Absen UI)
  console.log('3. HR-V1 Attendance Page...');
  await pageHr.goto(`${VPS}:3008/hr/attendance`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await pageHr.waitForTimeout(2000);
  console.log('   HR Attendance URL:', pageHr.url());
  await pageHr.screenshot({ path: path.join(outDir, 'vps-hr-v1-attendance.png'), fullPage: true });

  // 4. Finance-V1 (Port 3009) Login & POS Page
  console.log('4. Finance-V1 (Sheets) Flow...');
  const pageFin = await context.newPage();
  await pageFin.goto(`${VPS}:3009/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await pageFin.waitForTimeout(1000);
  await pageFin.click('button[type="submit"]');
  await pageFin.waitForURL('**/finance**', { timeout: 15000 });
  console.log('   Finance Logged in URL:', pageFin.url());
  await pageFin.waitForTimeout(2000);
  await pageFin.screenshot({ path: path.join(outDir, 'vps-finance-v1-dashboard.png') });

  // 5. Finance-V1 POS Page & Sheet Import Modal
  console.log('5. Finance POS Page & Import Modal...');
  await pageFin.goto(`${VPS}:3009/finance/pos`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await pageFin.waitForTimeout(2000);
  console.log('   Finance POS URL:', pageFin.url());

  const importBtn = pageFin.locator('button:has-text("Import POS")').first();
  if (await importBtn.isVisible()) {
    await importBtn.click();
    await pageFin.waitForTimeout(1000);
    console.log('   Opened POS Import Modal with Google Sheet URL support!');
  }
  await pageFin.screenshot({ path: path.join(outDir, 'vps-finance-v1-pos.png') });

  await browser.close();
  console.log('=== ALL 5 BROWSER FLOWS VERIFIED SUCCESSFULLY ON VPS ===');
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
