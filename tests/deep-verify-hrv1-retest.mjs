/**
 * Retest hr-v1 pages that cascaded after /hr/lateness 500,
 * plus clock-in 500 body, phase4 approval scan, payroll route discovery.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://ykp-hr-v1-standalone-production.up.railway.app";
const CHROME = "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe";
const OUT = path.resolve(
  "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/tests/deep-verify-hrv1-retest.json"
);
const SHOTS = path.resolve(
  "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/tests/screenshots/deep-verify-2026-07-12"
);
fs.mkdirSync(SHOTS, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const report = { ts: new Date().toISOString(), pages: [], clicks: [], apis: [], findings: [] };
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const net5xx = [];
  page.on("response", (r) => {
    if (r.status() >= 500) net5xx.push(`${r.status()} ${r.url()}`);
  });

  // login
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 45000 });
  await sleep(1000);
  await page.locator("input").first().fill("owner");
  await page.locator('input[type="password"]').first().fill("owner123");
  const lp = page
    .waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 20000 })
    .catch(() => null);
  await page.locator('button[type="submit"]').first().click();
  const lr = await lp;
  await sleep(2000);
  console.log("login", lr?.status(), page.url());

  // cookie for CLI
  const cookies = await ctx.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // probe payroll-related APIs
  const apiCandidates = [
    "/api/hr/payroll",
    "/api/hr/payroll/list",
    "/api/hr/payroll/runs",
    "/api/payroll",
    "/api/hr/payslips",
    "/api/hr/summary",
    "/api/hr/lateness",
    "/api/hr/attendance/clock-in",
  ];
  for (const a of apiCandidates) {
    try {
      const isPost = a.includes("clock-in");
      const res = await fetch(BASE + a, {
        method: isPost ? "POST" : "GET",
        headers: {
          Cookie: cookieHeader,
          Accept: "application/json",
          ...(isPost ? { "Content-Type": "application/json" } : {}),
        },
        body: isPost ? JSON.stringify({ employee_id: "EMP-00001" }) : undefined,
      });
      const body = (await res.text()).slice(0, 400);
      report.apis.push({ path: a, status: res.status, body });
      console.log(`API ${a} → ${res.status} ${body.slice(0, 120).replace(/\s+/g, " ")}`);
      if (res.status >= 500) {
        report.findings.push({
          severity: "critical",
          title: `${a} → ${res.status}`,
          body,
        });
      }
    } catch (e) {
      report.apis.push({ path: a, error: String(e.message || e) });
    }
    await sleep(300);
  }

  const pages = [
    "/hr/lateness",
    "/hr/leaves",
    "/hr/payroll",
    "/hr/payroll/generate",
    "/hr/adjustments",
    "/hr/summary",
    "/hr/roster",
    "/hr/employees",
  ];

  for (const p of pages) {
    net5xx.length = 0;
    try {
      // abort any pending nav
      await page.goto("about:blank").catch(() => null);
      await sleep(300);
      const resp = await page.goto(BASE + p, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
      await sleep(2500);
      const status = resp?.status() ?? 0;
      const body = await page.locator("body").innerText().catch(() => "");
      const buttons = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
          .map((b) => (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50))
          .filter(Boolean)
      );
      const shot = path.join(SHOTS, `retest${p.replace(/\//g, "_")}.png`);
      await page.screenshot({ path: shot, fullPage: false }).catch(() => null);
      const row = {
        path: p,
        status,
        url: page.url(),
        buttons: buttons.slice(0, 25),
        buttonCount: buttons.length,
        net5xx: [...net5xx],
        bodySnippet: body.slice(0, 300).replace(/\s+/g, " "),
        shot,
      };
      report.pages.push(row);
      console.log(
        `${p} HTTP${status} btn=${buttons.length} 5xx=${net5xx.length} :: ${body.slice(0, 80).replace(/\s+/g, " ")}`
      );

      if (status >= 500) {
        report.findings.push({
          severity: "critical",
          title: `${p} HTTP ${status}`,
          body: body.slice(0, 200),
        });
      }

      // approval scan
      const labels = buttons.map((t) => t.toLowerCase());
      const hasApprove = labels.some((t) => /approve|setujui|terima/.test(t));
      const hasReject = labels.some((t) => /reject|tolak/.test(t));
      const hasMarkPaid = labels.some((t) => /mark.?paid|bayar|paid|lunas/.test(t));
      if (["/hr/leaves", "/hr/adjustments", "/hr/payroll"].includes(p)) {
        report.clicks.push({
          path: p,
          hasApprove,
          hasReject,
          hasMarkPaid,
          labels: buttons.slice(0, 15),
        });
        console.log(
          `  approval: approve=${hasApprove} reject=${hasReject} markPaid=${hasMarkPaid}`
        );
        if (!hasApprove) {
          report.findings.push({
            severity: "high",
            title: `${p}: no Approve button`,
            area: "phase4-gap",
          });
        }
        if (p !== "/hr/payroll" && !hasReject) {
          report.findings.push({
            severity: "high",
            title: `${p}: no Reject button`,
            area: "phase4-gap",
          });
        }
        if (p === "/hr/payroll" && !hasApprove && !hasMarkPaid) {
          report.findings.push({
            severity: "high",
            title: `${p}: no Approve/Mark-paid button`,
            area: "phase4-gap",
          });
        }
      }

      // open add dialog on leaves/adjustments — check employee select
      if (p === "/hr/leaves" || p === "/hr/adjustments") {
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("button")).find((x) =>
            /tambah|ajukan|baru|add|new/i.test(x.textContent || "")
          );
          b?.click();
        });
        await sleep(1200);
        const selects = await page.evaluate(() =>
          Array.from(document.querySelectorAll("select")).map((s) => ({
            name: s.name || s.id || s.getAttribute("aria-label") || "",
            count: s.options.length,
            opts: Array.from(s.options)
              .map((o) => o.textContent?.trim())
              .filter(Boolean)
              .slice(0, 8),
          }))
        );
        report.clicks.push({ path: p, dialogSelects: selects });
        console.log(`  selects: ${JSON.stringify(selects).slice(0, 250)}`);
        const anyPopulated = selects.some((s) => s.count > 1);
        if (selects.length && !anyPopulated) {
          report.findings.push({
            severity: "high",
            title: `${p}: employee dropdown empty`,
            area: "known-issue",
          });
        }
        await page.keyboard.press("Escape").catch(() => null);
      }

      // click Generate on payroll if present
      if (p === "/hr/payroll" || p === "/hr/payroll/generate") {
        const before = page.url();
        const net = [];
        const h = (r) => {
          if (r.url().includes("/api/")) net.push({ url: r.url(), status: r.status() });
        };
        page.on("response", h);
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("button")).find((x) =>
            /generate|run|buat|simulasi/i.test(x.textContent || "")
          );
          b?.click();
        });
        await sleep(2000);
        page.off("response", h);
        report.clicks.push({
          path: p,
          generateClick: true,
          net,
          urlAfter: page.url(),
        });
        console.log(`  generate net: ${JSON.stringify(net).slice(0, 200)}`);
        const bad = net.filter((n) => n.status >= 500);
        if (bad.length) {
          report.findings.push({
            severity: "critical",
            title: `${p} generate → 5xx`,
            body: JSON.stringify(bad),
          });
        }
        if (page.url() !== before) {
          await page.goto(BASE + p, { waitUntil: "domcontentloaded" }).catch(() => null);
          await sleep(1000);
        }
      }
    } catch (e) {
      report.pages.push({ path: p, error: String(e.message || e).slice(0, 300) });
      report.findings.push({
        severity: "critical",
        title: `${p} crashed`,
        body: String(e.message || e).slice(0, 200),
      });
      console.log(`${p} CRASH`, String(e.message || e).slice(0, 150));
    }
  }

  // logout presence
  await page.goto(BASE + "/hr", { waitUntil: "domcontentloaded" });
  await sleep(1000);
  const hasLogout = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, a")).some((el) =>
      /logout|keluar|sign out/i.test(el.textContent || "")
    )
  );
  report.clicks.push({ path: "/hr", hasLogout });
  if (!hasLogout) {
    report.findings.push({
      severity: "medium",
      title: "Sidebar logout missing",
      area: "phase5-gap",
    });
  }
  console.log("logout button:", hasLogout);

  // clock-in single employee carefully
  await page.goto(BASE + "/hr/attendance", { waitUntil: "domcontentloaded" });
  await sleep(2000);
  const clockBodies = [];
  page.on("response", async (r) => {
    if (r.url().includes("clock-in") || r.url().includes("attendance")) {
      try {
        const t = await r.text();
        clockBodies.push({ url: r.url(), status: r.status(), body: t.slice(0, 300) });
      } catch {
        /* ignore */
      }
    }
  });
  // click first Clock in only
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) =>
      /clock in/i.test(x.textContent || "")
    );
    b?.click();
  });
  await sleep(2500);
  report.clicks.push({ path: "/hr/attendance", clockIn: clockBodies });
  console.log("clock-in responses:", JSON.stringify(clockBodies).slice(0, 500));
  for (const c of clockBodies) {
    if (c.status >= 500) {
      report.findings.push({
        severity: "critical",
        title: `clock-in ${c.status}`,
        body: c.body,
      });
    }
  }

  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("\nFindings:", report.findings.length);
  for (const f of report.findings) console.log(`- [${f.severity}] ${f.title}`);
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
