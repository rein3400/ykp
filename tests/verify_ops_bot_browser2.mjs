import { chromium, request } from 'playwright';

const BASE = 'https://ops.oseedigital.tech';

// 1. Login via API to get session cookie
const api = await request.newContext();
const loginRes = await api.post(`${BASE}/api/auth/login`, {
  data: { username: 'owner', password: 'owner123' },
});
console.log('login status:', loginRes.status());
const setCookie = loginRes.headers()['set-cookie'];
console.log('set-cookie:', setCookie);

// Extract cookie value
const cookieMatch = setCookie?.match(/ykp_ops_session=([^;]+)/);
const cookieValue = cookieMatch ? cookieMatch[1] : null;
console.log('cookie value present:', Boolean(cookieValue));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
if (cookieValue) {
  await ctx.addCookies([{
    name: 'ykp_ops_session',
    value: cookieValue,
    domain: 'ops.oseedigital.tech',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
}
const page = await ctx.newPage();

try {
  await page.goto(`${BASE}/ops/telegram`, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('url after goto:', page.url());
  await page.screenshot({ path: 'tests/ops-bot-04-telegram-page.png' });

  // Check if we're on login or telegram page
  const isLogin = page.url().includes('/login');
  console.log('isLogin:', isLogin);

  if (!isLogin) {
    const getCodeBtn = page.locator('button', { hasText: 'Dapatkan Kode' }).first();
    await getCodeBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'tests/ops-bot-05-after-code.png' });

    const links = await page.locator('a[href*="t.me/"]').evaluateAll(els => els.map(e => e.href));
    console.log('deep links:', JSON.stringify(links));

    const codeText = await page.locator('div.font-mono').first().textContent().catch(() => null);
    console.log('code:', codeText);

    console.log('RESULT botIsJustatest:', links.some(l => l.includes('justatestermaybot')));
  }
} catch (e) {
  console.log('ERROR:', e.message);
  await page.screenshot({ path: 'tests/ops-bot-error.png' });
} finally {
  await browser.close();
  await api.dispose();
}
