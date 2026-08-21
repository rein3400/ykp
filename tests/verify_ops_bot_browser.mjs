import { chromium } from 'playwright';

const BASE = 'https://ops.oseedigital.tech';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const log = [];
const step = (s) => { log.push(s); console.log(s); };

try {
  // 1. Login
  step('1. goto /login');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'tests/ops-bot-01-login.png' });

  const userInput = page.locator('input[name="username"], input[type="text"]').first();
  const passInput = page.locator('input[name="password"], input[type="password"]').first();
  await userInput.fill('owner');
  await passInput.fill('owner123');
  await page.screenshot({ path: 'tests/ops-bot-02-login-filled.png' });

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  step('2. after login url: ' + page.url());
  await page.screenshot({ path: 'tests/ops-bot-03-after-login.png' });

  // 2. Go to telegram page
  step('3. goto /ops/telegram');
  await page.goto(`${BASE}/ops/telegram`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 'tests/ops-bot-04-telegram-page.png' });

  // 3. Click "Dapatkan Kode"
  const getCodeBtn = page.locator('button', { hasText: 'Dapatkan Kode' }).first();
  await getCodeBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/ops-bot-05-after-code.png' });

  // 4. Extract deep link
  const links = await page.locator('a[href*="t.me/"]').evaluateAll(els => els.map(e => e.href));
  step('4. deep links: ' + JSON.stringify(links));

  // 5. Extract code text
  const codeText = await page.locator('div.font-mono').first().textContent().catch(() => null);
  step('5. code: ' + codeText);

  const result = {
    loginOk: page.url().includes('/ops') || page.url().includes('/login') === false,
    finalUrl: page.url(),
    deepLinks: links,
    code: codeText,
    botIsJustatest: links.some(l => l.includes('justatestermaybot')),
  };
  step('RESULT: ' + JSON.stringify(result, null, 2));
} catch (e) {
  step('ERROR: ' + e.message);
  await page.screenshot({ path: 'tests/ops-bot-error.png' });
} finally {
  await browser.close();
}
