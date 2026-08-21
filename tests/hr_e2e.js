// HR V1 E2E test: login + 9 sections
const { chromium } = require('playwright');

const BASE = 'https://hr-v1.oseedigital.tech';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', 'owner');
  await page.fill('input[name="password"]', 'owner123');
  await page.click('button[type="submit"], button:has-text("Masuk")');
  await page.waitForTimeout(3000);

  const url = page.url();
  const title = await page.title();
  console.log(`Login: ${url} | Title: ${title}`);
  const body = await page.textContent('body');
  if (url.includes('login')) {
    console.log('LOGIN FAILED - still on login page');
    console.log(body.substring(0, 300));
    await browser.close();
    process.exit(1);
  }
  console.log('LOGIN OK');

  // Test all 9 sections
  const sections = [
    { name: 'Dashboard', path: '/hr' },
    { name: 'Attendance', path: '/hr/attendance' },
    { name: 'Employees', path: '/hr/employees' },
    { name: 'Roster', path: '/hr/roster' },
    { name: 'Lateness', path: '/hr/lateness' },
    { name: 'Leaves', path: '/hr/leaves' },
    { name: 'Payroll', path: '/hr/payroll' },
    { name: 'Adjustments', path: '/hr/adjustments' },
    { name: 'Summary', path: '/hr/summary' },
    { name: 'Users', path: '/hr/users' },
  ];

  for (const sec of sections) {
    await page.goto(`${BASE}${sec.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const title = await page.title();
    const code = await page.evaluate(() => {
      // Check for error page or redirect
      const hasError = document.body.textContent?.includes('Error') ||
                       document.body.textContent?.includes('404') ||
                       document.body.textContent?.includes('Something went wrong');
      return { hasError, title: document.title, url: window.location.href };
    });

    const hasTable = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table ? table.rows.length - 1 : -1; // -1 for header
    });

    console.log(`${sec.name}: ${code.hasError ? 'ERROR' : 'OK'} | Rows: ${hasTable} | Title: ${code.title} | ${code.url}`);
  }

  // Test Employees > Import page
  await page.goto(`${BASE}/hr/employees/import`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log(`Employees Import: ${page.url()} | Title: ${await page.title()}`);

  // Test Payroll > Generate page
  await page.goto(`${BASE}/hr/payroll/generate`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log(`Payroll Generate: ${page.url()} | Title: ${await page.title()}`);

  await browser.close();
  console.log('=== HR V1 E2E COMPLETE ===');
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
