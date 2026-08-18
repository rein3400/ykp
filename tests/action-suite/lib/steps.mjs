import path from 'node:path';
import fs from 'node:fs';
import { waitSettled, safeName } from './dom.mjs';

function tpl(str, ctx) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (ctx[k] !== undefined ? String(ctx[k]) : `{{${k}}}`));
}

async function findTarget(page, step) {
  const candidates = [];
  if (step.role && step.name) {
    const nameRe = step.name instanceof RegExp ? step.name : new RegExp(String(step.name).replace(/^\/|\/[a-z]*$/gi, ''), 'i');
    candidates.push(page.getByRole(step.role, { name: nameRe }));
  }
  if (step.text) {
    const textRe = step.text instanceof RegExp ? step.text : new RegExp(String(step.text).replace(/^\/|\/[a-z]*$/gi, ''), 'i');
    candidates.push(page.locator(`text=${textRe}`));
  }
  if (step.selector) candidates.push(page.locator(step.selector));
  if (step.placeholder) candidates.push(page.getByPlaceholder(step.placeholder));
  if (step.label) candidates.push(page.getByLabel(step.label));
  if (step.nth !== undefined && candidates.length) {
    const base = candidates[0];
    candidates.push(base.nth(step.nth));
  }
  if (step.fallbackSelector) candidates.push(page.locator(step.fallbackSelector));

  for (const cand of candidates) {
    try {
      if (await cand.count()) return cand.first();
    } catch {}
  }
  return null;
}

export async function executeStep(page, step, ctx = {}) {
  const name = step.do;
  try {
    switch (name) {
      case 'goto': {
        const base = ctx.base || '';
        const pathVal = tpl(step.path || step.url || '/', ctx);
        const url = pathVal.startsWith('http') ? pathVal : base.replace(/\/$/, '') + pathVal;
        await page.goto(url, { waitUntil: 'networkidle', timeout: step.timeout || 30000 });
        return { ok: true, name, target: url };
      }
      case 'click': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        await target.click({ timeout: step.timeout || 5000 });
        return { ok: true, name, target: step.selector || step.text || step.name || step.role };
      }
      case 'dblclick': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        await target.dblclick({ timeout: step.timeout || 5000 });
        return { ok: true, name };
      }
      case 'fill': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        const value = tpl(step.value ?? '', ctx);
        await target.fill(String(value), { timeout: step.timeout || 5000 });
        return { ok: true, name, value: String(value).slice(0, 80) };
      }
      case 'select': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        if (step.option !== undefined) {
          const options = await target.locator('option').allTextContents();
          const opt = options[step.option];
          if (opt !== undefined) await target.selectOption({ label: opt });
        } else if (step.value !== undefined) {
          await target.selectOption({ value: tpl(String(step.value), ctx) });
        } else if (step.label) {
          await target.selectOption({ label: tpl(String(step.label), ctx) });
        }
        return { ok: true, name };
      }
      case 'check': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        await target.check({ timeout: step.timeout || 5000 });
        return { ok: true, name };
      }
      case 'uncheck': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        await target.uncheck({ timeout: step.timeout || 5000 });
        return { ok: true, name };
      }
      case 'press': {
        const key = step.key || 'Enter';
        await page.keyboard.press(key);
        return { ok: true, name, key };
      }
      case 'hover': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        await target.hover({ timeout: step.timeout || 5000 });
        return { ok: true, name };
      }
      case 'waitFor': {
        if (step.selector) {
          await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
        } else if (step.text) {
          await page.waitForSelector(`text=${step.text}`, { timeout: step.timeout || 10000 });
        } else if (step.ms) {
          await page.waitForTimeout(step.ms);
        }
        return { ok: true, name };
      }
      case 'waitSettled': {
        await waitSettled(page, step.ms || 1500);
        return { ok: true, name };
      }
      case 'expectDialog': {
        const timeout = step.timeout || 5000;
        const dialog = page.locator('[role="dialog"], .dialog, [data-state="open"], .modal, [class*="Dialog"], [class*="Modal"]').first();
        await dialog.waitFor({ state: 'visible', timeout });
        return { ok: true, name };
      }
      case 'closeDialog': {
        const closeBtn = page.locator('button[aria-label*="close" i], button:has-text("Close"), button:has-text("Tutup"), [data-state="open"] button').first();
        if (await closeBtn.count()) await closeBtn.click();
        else await page.keyboard.press('Escape');
        return { ok: true, name };
      }
      case 'screenshot': {
        const outDir = ctx.screenshotDir || process.cwd();
        const fname = `${safeName(step.name || 'shot')}.png`;
        const fpath = path.join(outDir, fname);
        fs.mkdirSync(outDir, { recursive: true });
        await page.screenshot({ path: fpath, fullPage: true });
        return { ok: true, name, path: fpath };
      }
      case 'apiFetch': {
        const url = tpl(step.url, ctx);
        const method = step.method || 'GET';
        const body = step.body ? tpl(JSON.stringify(step.body), ctx) : undefined;
        const result = await page.evaluate(async ({ url, method, body }) => {
          const res = await fetch(url, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body,
            credentials: 'include',
          });
          const text = await res.text();
          let json;
          try { json = JSON.parse(text); } catch { json = text; }
          return { status: res.status, ok: res.ok, json };
        }, { url, method, body });
        if (step.saveAs) ctx.vars[step.saveAs] = result.json;
        if (step.pick && step.as) {
          const parts = step.pick.split('.');
          let val = result.json;
          for (const p of parts) val = val?.[p];
          ctx.vars[step.as] = val;
        }
        return { ok: result.ok, name, status: result.status, json: result.json };
      }
      case 'upload': {
        const target = await findTarget(page, step);
        if (!target) return { ok: false, name, reason: 'target not found', step };
        const filePath = tpl(step.path || step.file, ctx);
        const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        await target.setInputFiles(abs);
        return { ok: true, name, file: abs };
      }
      case 'download': {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: step.timeout || 10000 }),
          findTarget(page, step).then((t) => t && t.click()),
        ]);
        const outDir = ctx.screenshotDir || process.cwd();
        fs.mkdirSync(outDir, { recursive: true });
        const savePath = path.join(outDir, download.suggestedFilename());
        await download.saveAs(savePath);
        return { ok: true, name, path: savePath };
      }
      case 'login': {
        const { login } = await import('./auth.mjs');
        await login(page, ctx.app);
        return { ok: true, name };
      }
      case 'logout': {
        const { logout } = await import('./auth.mjs');
        await logout(page);
        return { ok: true, name };
      }
      case 'sso': {
        const { loginSsoGet } = await import('./auth.mjs');
        await loginSsoGet(page, ctx.app);
        return { ok: true, name };
      }
      default:
        return { ok: false, name, reason: `unknown step type: ${name}` };
    }
  } catch (err) {
    return { ok: false, name, reason: err.message, step };
  }
}

export async function executeVerify(page, verify, ctx = {}) {
  const type = verify.type;
  try {
    switch (type) {
      case 'noErrorText': {
        const count = await page.locator(verify.selector).count();
        return { ok: count === 0, type, count };
      }
      case 'errorTextContains': {
        const el = page.locator(verify.selector || 'p.text-destructive');
        const text = await el.first().innerText().catch(() => '');
        const ok = text.toLowerCase().includes(String(verify.text || '').toLowerCase());
        return { ok, type, text };
      }
      case 'rowVisible': {
        const text = tpl(verify.text, ctx);
        const count = await page.locator(`text=${text}`).count();
        return { ok: count > 0, type, count };
      }
      case 'urlMatches': {
        const re = new RegExp(verify.pattern);
        return { ok: re.test(page.url()), type, url: page.url() };
      }
      case 'dialogClosed': {
        const count = await page.locator('[role="dialog"], .dialog, [data-state="open"]').count();
        return { ok: count === 0, type, count };
      }
      case 'noNetwork5xx': {
        const fails = (ctx.networkFails || []).filter((f) => f.status >= 500);
        return { ok: fails.length === 0, type, fails };
      }
      case 'noConsoleErrors': {
        const errs = ctx.consoleErrors || [];
        return { ok: errs.length === 0, type, errs: errs.slice(0, 5) };
      }
      case 'apiReturns': {
        const url = tpl(verify.url, ctx);
        const result = await page.evaluate(async (url) => {
          const res = await fetch(url, { credentials: 'include' });
          return { status: res.status, ok: res.ok, json: await res.json().catch(() => null) };
        }, url);
        const expectStatus = verify.status ?? 200;
        const ok = result.ok && result.status === expectStatus;
        return { ok, type, status: result.status, json: result.json };
      }
      case 'fileDownloaded': {
        const dir = ctx.screenshotDir || process.cwd();
        const files = fs.readdirSync(dir).filter((f) => f.endsWith(verify.ext || '.csv') || f.endsWith(verify.ext || '.pdf'));
        return { ok: files.length > 0, type, files };
      }
      default:
        return { ok: false, type, reason: `unknown verify type: ${type}` };
    }
  } catch (err) {
    return { ok: false, type, reason: err.message };
  }
}
