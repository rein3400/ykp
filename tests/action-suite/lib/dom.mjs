export function safeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function waitSettled(page, ms = 1500) {
  await page.waitForTimeout(ms);
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {}
}

export async function pageHealth(page) {
  const bodyText = await page.evaluate(() => document.body?.innerText || '');
  const buttons = await page.locator('button').count();
  const inputs = await page.locator('input').count();
  const tables = await page.locator('table').count();
  const errorText = /internal server error|502 bad gateway|503 service unavailable|unauthorized|application error/i.test(bodyText);
  return {
    url: page.url(),
    buttons,
    inputs,
    tables,
    errorText,
    bodyPreview: bodyText.slice(0, 500),
  };
}

export async function listInteractives(page) {
  const buttons = await page.locator('button:visible').evaluateAll((els) =>
    els.map((el) => ({
      tag: 'button',
      text: (el.innerText || '').trim().slice(0, 80),
      aria: el.getAttribute('aria-label') || '',
      disabled: el.disabled,
    }))
  );
  const links = await page.locator('a:visible').evaluateAll((els) =>
    els.map((el) => ({
      tag: 'a',
      text: (el.innerText || '').trim().slice(0, 80),
      href: el.getAttribute('href') || '',
    }))
  );
  const inputs = await page.locator('input:visible').evaluateAll((els) =>
    els.map((el) => ({
      tag: 'input',
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || '',
      placeholder: el.getAttribute('placeholder') || '',
    }))
  );
  const selects = await page.locator('select:visible').evaluateAll((els) =>
    els.map((el) => ({
      tag: 'select',
      name: el.getAttribute('name') || '',
    }))
  );
  return { buttons, links, inputs, selects };
}
