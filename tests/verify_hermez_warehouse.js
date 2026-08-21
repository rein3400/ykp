// Re-verify hermez /warehouse after rate-limit cooldown.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'output', 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://hermez.oseedigital.tech/api/auth/login?role=SUPER_ADMIN&redirect=/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    await page.goto('https://hermez.oseedigital.tech/warehouse', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const title = await page.title().catch(() => '');
    const body = await page.locator('body').innerText().catch(() => '');
    const h1 = await page.locator('h1').first().innerText().catch(() => '');
    const isRateLimit = /rate_limited|too many requests/i.test(body);
    const isError = /couldn't load|application error|internal server error/.test((title + ' ' + body).toLowerCase());
    if (!isRateLimit && !isError && body.trim().length >= 20) {
      ok = true;
      const dir = path.join(OUT, 'hermez');
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'warehouse-fixed.png') }).catch(() => {});
      fs.writeFileSync(path.join(dir, 'warehouse-fixed.txt'), `TITLE: ${title}\nH1: ${h1}\n\n${body.slice(0, 3000)}`);
      console.log(`PASS hermez /warehouse | ${h1 || title}`);
    } else {
      console.log(`attempt ${attempt}: rate-limit/error, retrying... (${body.slice(0, 80)})`);
      await page.waitForTimeout(15000);
    }
  }
  await ctx.close();
  await browser.close();
  if (!ok) { console.log('FAIL hermez /warehouse after 3 attempts'); process.exit(1); }
})();
