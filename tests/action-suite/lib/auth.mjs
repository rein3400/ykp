export async function loginHubForm(page, app) {
  const base = app.base.replace(/\/$/, '');
  await page.goto(base + (app.loginPath || '/login'), { waitUntil: 'networkidle' });
  await page.fill("input[autocomplete='username']", app.username || 'owner');
  await page.fill("input[autocomplete='current-password']", app.password || 'owner123');
  await page.click("button[type='submit']");
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export async function loginPasswordForm(page, app) {
  const base = app.base.replace(/\/$/, '');
  await page.goto(base + (app.loginPath || '/login'), { waitUntil: 'networkidle' });

  const textInput = page.locator('input[type="text"], input:not([type="password"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"])').first();
  const passInput = page.locator('input[type="password"]').first();

  await textInput.fill(app.username || 'owner');
  await passInput.fill(app.password || 'owner123');

  const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk"), button:has-text("Sign in")').first();
  await submitBtn.click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export async function loginSsoGet(page, app) {
  const base = app.base.replace(/\/$/, '');
  const redirect = encodeURIComponent(app.redirect || '/');
  const url = `${base}/api/auth/login?role=${encodeURIComponent(app.role || 'OWNER')}&redirect=${redirect}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForLoadState('networkidle');
}

export async function logout(page) {
  const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Keluar"), a:has-text("Keluar")').first();
  if (await logoutBtn.count()) {
    await logoutBtn.click();
    await page.waitForLoadState('networkidle');
  }
}

export async function isLoggedIn(page) {
  try {
    const res = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/auth/me', { credentials: 'include' });
        return r.ok;
      } catch {
        return false;
      }
    });
    if (res) return true;
  } catch {}
  return !page.url().includes('/login');
}

export async function ensureSession(page, app) {
  const ok = await isLoggedIn(page);
  if (!ok) {
    await login(page, app);
  }
}

export async function login(page, app) {
  switch (app.auth) {
    case 'hub-form':
      return loginHubForm(page, app);
    case 'password':
      return loginPasswordForm(page, app);
    case 'sso':
      return loginSsoGet(page, app);
    default:
      throw new Error(`Unknown auth mode: ${app.auth}`);
  }
}
