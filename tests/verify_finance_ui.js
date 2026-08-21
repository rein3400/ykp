const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1. Open finance app
  await page.goto('https://finance.oseedigital.tech', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('TITLE:', await page.title());
  console.log('URL:', page.url());

  // 2. Login via SSO GET (mints OWNER cookie)
  await page.goto('https://finance.oseedigital.tech/api/auth/login?role=OWNER&redirect=/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  console.log('AFTER LOGIN URL:', page.url());

  // 3. Snapshot main content
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('BODY TEXT (first 800):\n', bodyText);

  // 4. Test export CSV endpoint via fetch in page context
  const exportResult = await page.evaluate(async () => {
    const r = await fetch('/api/fin/export/csv?report=summary&date_from=2026-08-01&date_to=2026-08-31');
    return { status: r.status, text: (await r.text()).slice(0, 300) };
  });
  console.log('EXPORT CSV:', JSON.stringify(exportResult, null, 2));

  // 5. Screenshot
  await page.screenshot({ path: 'output/playwright/finance-home.png', fullPage: false });
  console.log('SCREENSHOT saved');

  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
