// Hub E2E test: login + view modules + click SSO links
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // Test 1: Hub root page loads
  await page.goto('https://oseedigital.tech/', { waitUntil: 'networkidle' });
  console.log('=== HUB ROOT LOADED ===');
  console.log('Title:', await page.title());
  console.log('URL:', page.url());

  // Test 2: Fill login form
  const username = page.locator('input').first();
  const password = page.locator('input[type="password"]');
  const signIn = page.locator('button:has-text("Sign in")');

  await username.fill('owner');
  await password.fill('owner123');
  await signIn.click();

  // Wait for dashboard / error
  await page.waitForTimeout(3000);
  console.log('=== AFTER LOGIN ===');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  // Check if we got to dashboard or error
  const body = await page.textContent('body');
  if (body.includes('Dashboard') || body.includes('HR') || body.includes('Finance')) {
    console.log('LOGIN SUCCESS');
  } else {
    console.log('LOGIN FAILED');
    console.log('Body:', body.substring(0, 500));
  }

  // Test 3: Check module links
  const links = await page.$$('a');
  console.log('=== MODULE LINKS ===');
  for (const link of links) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    console.log(text?.trim(), '->', href);
  }

  await browser.close();
})().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
