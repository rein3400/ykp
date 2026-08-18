import { chromium } from 'playwright';

export async function launchBrowser(options = {}) {
  const headed = options.headed ?? process.env.HEADED === 'true';
  const executablePath = options.executablePath || process.env.CHROME_PATH || undefined;
  const browser = await chromium.launch({
    headless: !headed,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return browser;
}

export async function newContext(browser, options = {}) {
  return browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
}

export function attachCollectors(page, bucket) {
  bucket.consoleErrors = bucket.consoleErrors || [];
  bucket.networkFails = bucket.networkFails || [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      bucket.consoleErrors.push(msg.text());
    }
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      bucket.networkFails.push({
        url: response.url(),
        status,
        statusText: response.statusText(),
      });
    }
  });

  page.on('pageerror', (err) => {
    bucket.consoleErrors.push(`PAGEERROR: ${err.message}`);
  });
}
