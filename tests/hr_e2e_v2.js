// HR V1 E2E v2: proper error detection + check specific pages
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
  console.log(`Login: ${page.url()} | ${await page.title()}`);

  const sections = [
    ['Dashboard', '/hr'], ['Attendance', '/hr/attendance'], ['Employees', '/hr/employees'],
    ['Roster', '/hr/roster'], ['Lateness', '/hr/lateness'], ['Leaves', '/hr/leaves'],
    ['Payroll', '/hr/payroll'], ['Adjustments', '/hr/adjustments'], ['Summary', '/hr/summary'],
    ['Users', '/hr/users'], ['Emp Import', '/hr/employees/import'], ['Payroll Gen', '/hr/payroll/generate'],
  ];

  for (const [name, path] of sections) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const status = await page.evaluate(() => {
      // Look for actual error messages, not just the word "Error"
      const errorMsgs = document.querySelectorAll('[role="alert"]');
      const alerts = [];
      errorMsgs.forEach(el => { if (el.textContent.trim()) alerts.push(el.textContent.trim().substring(0, 200)); });

      // Check sidebar navigation works
      const sidebarLinks = document.querySelectorAll('nav a, aside a');

      // Check data table
      const table = document.querySelector('table');
      const tbody = table?.querySelector('tbody');
      const rowCount = tbody ? tbody.rows.length : (table ? table.rows.length - 1 : 0);

      // Check for button counts (Add, Export, Filter, etc.)
      const buttons = document.querySelectorAll('button:not([aria-hidden="true"])');

      // Check for input fields (search, filter, form)
      const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');

      return {
        alerts, sidebarCount: sidebarLinks.length, rowCount,
        buttonCount: buttons.length, inputCount: inputs.length,
        pageTitle: document.title, url: window.location.href
      };
    });

    const hasError = status.alerts.length > 0 ? 'ALERTS' : 'OK';
    console.log(`${name.padEnd(12)} | ${hasError} | rows:${status.rowCount} btns:${status.buttonCount} inputs:${status.inputCount} sidebar:${status.sidebarCount} | ${status.url.split('.tech')[1]}`);

    if (status.alerts.length > 0) {
      console.log(`  ALERTS: ${JSON.stringify(status.alerts)}`);
    }
  }

  // Test Employee detail page (first employee from list)
  await page.goto(`${BASE}/hr/employees`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const firstEmpLink = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const a of links) { if (a.href?.includes('/hr/employees/') && !a.href?.includes('/import') && !a.href?.includes('/new')) return a.href; }
    return null;
  });
  if (firstEmpLink) {
    await page.goto(firstEmpLink, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    console.log(`Emp Detail    | ${page.url()} | ${await page.title()}`);
  } else {
    console.log('Emp Detail    | No link found');
  }

  // Test Add Employee form page
  await page.goto(`${BASE}/hr/employees/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log(`Emp New       | ${page.url()} | ${await page.title()}`);

  await browser.close();
  console.log('=== HR V1 E2E COMPLETE ===');
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
