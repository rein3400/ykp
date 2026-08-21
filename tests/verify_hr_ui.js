const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const results = {};

  // HR (Postgres) - follow redirects
  try {
    await page.goto('https://hr.oseedigital.tech', { waitUntil: 'networkidle', timeout: 30000 });
    results.hr = { title: await page.title(), url: page.url(), body: (await page.evaluate(() => document.body.innerText.slice(0, 500))) };
  } catch (e) { results.hr = { error: e.message }; }

  // HR-v1 (Sheets) - follow redirects
  try {
    await page.goto('https://hr-v1.oseedigital.tech', { waitUntil: 'networkidle', timeout: 30000 });
    results.hrv1 = { title: await page.title(), url: page.url(), body: (await page.evaluate(() => document.body.innerText.slice(0, 500))) };
  } catch (e) { results.hrv1 = { error: e.message }; }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
