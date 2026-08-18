import path from 'node:path';
import { launchBrowser, newContext, attachCollectors } from './browser.mjs';
import { login, ensureSession } from './auth.mjs';
import { executeStep, executeVerify } from './steps.mjs';
import { loadReport, saveReport, addFinding } from './report.mjs';
import { actionScreenshotDir, writeEvidence } from './artifacts.mjs';

export class ActionRunner {
  constructor(app, actions, options = {}) {
    this.app = app;
    this.actions = actions;
    this.outDir = options.outDir || 'tests/action-suite';
    this.flags = options.flags || {};
    this.report = loadReport(this.outDir, app.id);
    this.browser = null;
    this.context = null;
  }

  async init() {
    this.browser = await launchBrowser({ headed: this.flags.headed });
    this.context = await newContext(this.browser);
    this.report.base = this.app.base;
    this.report.login = { ok: false, mode: this.app.auth, ms: 0 };
  }

  async close() {
    if (this.browser) await this.browser.close();
  }

  shouldSkip(action) {
    if (action.skip) return { skip: true, reason: 'marked skip' };
    if (action.destructive && !this.flags.includeDestructive) {
      return { skip: true, reason: 'destructive (requires --include-destructive)' };
    }
    if (this.flags.only && !this.flags.only.includes(action.id)) {
      return { skip: true, reason: 'not in --only list' };
    }
    if (this.flags.from && this.actions.indexOf(action) < this.actions.findIndex((a) => a.id === this.flags.from)) {
      return { skip: true, reason: 'before --from' };
    }
    const existing = this.report.actions.find((a) => a.id === action.id);
    if (existing && existing.status === 'pass' && !this.flags.rerunPassed) {
      return { skip: true, reason: 'already passed (resume)' };
    }
    return { skip: false };
  }

  async run() {
    await this.init();
    const start = Date.now();

    try {
      const loginStart = Date.now();
      const page = await this.context.newPage();
      const bucket = {};
      attachCollectors(page, bucket);
      await login(page, this.app);
      this.report.login = { ok: true, mode: this.app.auth, ms: Date.now() - loginStart };
      await page.close();
    } catch (err) {
      this.report.login = { ok: false, mode: this.app.auth, ms: Date.now() - loginStart, error: err.message };
      addFinding(this.report, 'CRITICAL', 'login', `Login failed: ${err.message}`);
      saveReport(this.outDir, this.app.id, this.report);
      await this.close();
      return;
    }

    for (const action of this.actions) {
      const { skip, reason } = this.shouldSkip(action);
      if (skip) {
        this.upsertAction({ id: action.id, title: action.title, status: 'skip', reason });
        saveReport(this.outDir, this.app.id, this.report);
        continue;
      }
      await this.runAction(action);
      saveReport(this.outDir, this.app.id, this.report);
    }

    this.report.durationMs = Date.now() - start;
    saveReport(this.outDir, this.app.id, this.report);
    await this.close();
  }

  upsertAction(entry) {
    const idx = this.report.actions.findIndex((a) => a.id === entry.id);
    if (idx >= 0) this.report.actions[idx] = entry;
    else this.report.actions.push(entry);
  }

  async runAction(action) {
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const page = await this.context.newPage();
    const bucket = {};
    attachCollectors(page, bucket);

    const screenshotDir = actionScreenshotDir(this.outDir, this.app.id, action.id);
    const ctx = {
      app: this.app,
      base: this.app.base,
      vars: { ts: Date.now() },
      screenshotDir,
      networkFails: bucket.networkFails,
      consoleErrors: bucket.consoleErrors,
    };

    const result = {
      id: action.id,
      title: action.title,
      module: action.module || this.app.id,
      status: 'error',
      startedAt,
      durationMs: 0,
      stepResults: [],
      verifyResults: [],
      consoleErrors: [],
      networkFails: [],
      screenshots: [],
      attempts: 1,
    };

    try {
      await ensureSession(page, this.app);

      for (const seed of action.seed || []) {
        const r = await executeStep(page, seed, ctx);
        result.stepResults.push({ phase: 'seed', ...r });
      }

      for (const step of action.steps || []) {
        const r = await executeStep(page, step, ctx);
        result.stepResults.push({ phase: 'steps', ...r });
        if (r.path) result.screenshots.push(r.path);
        if (!r.ok) {
          const shot = await this.captureFailure(page, screenshotDir, action.id, 'step-fail');
          if (shot) result.screenshots.push(shot);
          result.status = 'fail';
          result.error = r.reason;
          break;
        }
      }

      if (result.status !== 'fail') {
        let allOk = true;
        for (const verify of action.verify || []) {
          const r = await executeVerify(page, verify, ctx);
          result.verifyResults.push(r);
          if (!r.ok) allOk = false;
        }
        result.status = allOk ? 'pass' : 'fail';
        if (!allOk) {
          const shot = await this.captureFailure(page, screenshotDir, action.id, 'verify-fail');
          if (shot) result.screenshots.push(shot);
        }
      }

      for (const cleanup of action.cleanup || []) {
        if (cleanup.optional && result.status !== 'pass') continue;
        const r = await executeStep(page, cleanup, ctx);
        result.stepResults.push({ phase: 'cleanup', ...r });
      }
    } catch (err) {
      result.status = 'error';
      result.error = err.message;
      const shot = await this.captureFailure(page, screenshotDir, action.id, 'exception');
      if (shot) result.screenshots.push(shot);
    }

    result.durationMs = Date.now() - t0;
    result.consoleErrors = (bucket.consoleErrors || []).slice(0, 20);
    result.networkFails = (bucket.networkFails || []).slice(0, 20);

    writeEvidence(this.outDir, this.app.id, action.id, result);
    this.upsertAction(result);

    if (result.status === 'error' && !this.flags.noRetry) {
      result.attempts = 2;
      await this.runAction(action);
      return;
    }

    if (result.status === 'fail') {
      addFinding(this.report, 'HIGH', action.id, `Action failed: ${result.error || 'verify failed'}`);
    }
    if (result.networkFails.some((f) => f.status >= 500)) {
      addFinding(this.report, 'CRITICAL', action.id, 'Action caused 5xx network failure', result.networkFails.filter((f) => f.status >= 500));
    }
    if (result.consoleErrors.length > 0) {
      addFinding(this.report, 'MEDIUM', action.id, 'Console errors detected', result.consoleErrors.slice(0, 3));
    }
    if (result.durationMs > 10000) {
      addFinding(this.report, 'LOW', action.id, `Slow action: ${result.durationMs}ms`);
    }

    await page.close();
  }

  async captureFailure(page, dir, actionId, name) {
    try {
      const fpath = path.join(dir, `${name}.png`);
      await page.screenshot({ path: fpath, fullPage: true });
      return fpath;
    } catch {
      return null;
    }
  }

  exitCode() {
    const { fail, error } = this.report.totals;
    return fail + error > 0 ? 1 : 0;
  }
}
