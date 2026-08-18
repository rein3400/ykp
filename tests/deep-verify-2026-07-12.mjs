/**
 * Deep verification 2026-07-12
 * Goal: feature exists / works / production-ready / bugs
 * Method: CLI HTTP + Playwright click-through (one-by-one) on live Railway.
 *
 * Apps:
 *  - ykp-erp-finance / hermez / hr  (SSO role-picker)
 *  - ykp-hr-v1-standalone            (username/password)
 *  - ykp-hub                         (portal)
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("tests");
const SHOTS = path.join(ROOT, "screenshots", "deep-verify-2026-07-12");
const OUT = path.join(ROOT, "deep-verify-2026-07-12.json");
fs.mkdirSync(SHOTS, { recursive: true });

const CHROME = "C:/Users/stefa/AppData/Local/Google/Chrome/Application/chrome.exe";

const APPS = {
  finance: {
    name: "ykp-erp-finance",
    base: "https://ykp-erp-finance-production.up.railway.app",
    auth: "sso",
    ssoRole: "OWNER",
    pages: [
      "/",
      "/pos",
      "/suppliers",
      "/petty-cash",
      "/expenses",
      "/summary",
      "/analytics",
      "/settings",
      "/login",
    ],
    apis: [
      "/api/fin/summary",
      "/api/fin/pos",
      "/api/fin/expenses",
      "/api/fin/petty-cash",
      "/api/fin/suppliers",
      "/api/master/brands",
      "/api/master/outlets",
      "/api/auth/me",
    ],
  },
  hermez: {
    name: "ykp-erp-hermez",
    base: "https://ykp-erp-hermez-production.up.railway.app",
    auth: "sso",
    ssoRole: "SUPER_ADMIN",
    pages: ["/", "/alerts", "/config", "/run", "/telegram-test", "/login"],
    apis: [
      "/api/hermez/config",
      "/api/hermez/brief",
      "/api/hermez/alerts",
      "/api/hermez/health",
      "/api/auth/me",
    ],
  },
  hr: {
    name: "ykp-erp-hr",
    base: "https://ykp-erp-hr-production.up.railway.app",
    auth: "sso",
    ssoRole: "OWNER",
    pages: [
      "/",
      "/attendance",
      "/employees",
      "/payroll",
      "/rules",
      "/summary",
      "/login",
    ],
    apis: [
      "/api/hr/summary",
      "/api/hr/employees",
      "/api/hr/attendance",
      "/api/hr/payroll",
      "/api/master/brands",
      "/api/auth/me",
    ],
  },
  "hr-v1": {
    name: "ykp-hr-v1",
    base: "https://ykp-hr-v1-standalone-production.up.railway.app",
    auth: "password",
    user: "owner",
    pw: "owner123",
    pages: [
      "/login",
      "/hr",
      "/hr/employees",
      "/hr/employees/new",
      "/hr/attendance",
      "/hr/roster",
      "/hr/lateness",
      "/hr/leaves",
      "/hr/payroll",
      "/hr/payroll/generate",
      "/hr/adjustments",
      "/hr/summary",
    ],
    apis: [
      "/api/hr/summary",
      "/api/hr/employees",
      "/api/hr/attendance",
      "/api/hr/leaves",
      "/api/hr/payroll",
      "/api/hr/adjustments",
      "/api/hr/roster",
      "/api/auth/me",
    ],
  },
  hub: {
    name: "ykp-hub",
    base: "https://ykp-hub-production.up.railway.app",
    auth: "none",
    pages: ["/"],
    apis: [],
  },
};

const findings = [];
const pageResults = [];
const apiResults = [];
const clickResults = [];
const standards = [];

function finding(sev, app, area, title, detail, evidence = {}) {
  findings.push({
    severity: sev,
    app,
    area,
    title,
    detail,
    evidence,
    ts: new Date().toISOString(),
  });
  const tag =
    sev === "critical"
      ? "CRIT"
      : sev === "high"
        ? "HIGH"
        : sev === "medium"
          ? "MED"
          : "LOW";
  console.log(`[${tag}] [${app}] ${area}: ${title}`);
  if (detail) console.log(`       ${String(detail).slice(0, 200)}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function cliProbe(url, cookieHeader = null) {
  const t0 = Date.now();
  try {
    const headers = {
      Accept: "application/json,text/html,*/*",
      "User-Agent": "YKP-DeepVerify/2026-07-12",
    };
    if (cookieHeader) headers.Cookie = cookieHeader;
    const res = await fetch(url, {
      method: "GET",
      headers,
      redirect: "manual",
    });
    const ms = Date.now() - t0;
    const ct = res.headers.get("content-type") || "";
    let body = "";
    try {
      body = await res.text();
    } catch {
      body = "";
    }
    const setCookie = res.headers.getSetCookie?.() || [];
    return {
      status: res.status,
      ms,
      ct,
      body: body.slice(0, 1500),
      setCookie,
      location: res.headers.get("location"),
      headers: {
        csp: res.headers.get("content-security-policy") || "",
        xfo: res.headers.get("x-frame-options") || "",
        hsts: res.headers.get("strict-transport-security") || "",
        xcto: res.headers.get("x-content-type-options") || "",
      },
    };
  } catch (e) {
    return {
      status: 0,
      ms: Date.now() - t0,
      ct: "",
      body: String(e.message || e),
      setCookie: [],
      location: null,
      headers: {},
      error: true,
    };
  }
}

function extractCookies(setCookieArr) {
  return setCookieArr
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function looksLikeStackLeak(body) {
  if (!body) return false;
  return (
    /at\s+\w+\s+\(.*:\d+:\d+\)/.test(body) ||
    /Error:\s+/.test(body) && body.includes("node_modules") ||
    body.includes("\\n    at ")
  );
}

function parseJsonSafe(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function ssoCookie(base, role) {
  const url = `${base}/api/auth/login?role=${encodeURIComponent(role)}&redirect=/`;
  const r = await cliProbe(url);
  const cookies = extractCookies(r.setCookie);
  return {
    status: r.status,
    location: r.location,
    cookies,
    raw: r,
  };
}

async function passwordLoginCookie(base, user, pw) {
  // Try POST JSON first
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username: user, password: pw }),
      redirect: "manual",
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    const body = await res.text();
    return {
      status: res.status,
      cookies: extractCookies(setCookie),
      body: body.slice(0, 500),
      ms: Date.now() - t0,
    };
  } catch (e) {
    return { status: 0, cookies: "", body: String(e.message || e), ms: Date.now() - t0 };
  }
}

async function phaseCli() {
  console.log("\n========== PHASE 1: CLI SMOKE ==========\n");

  for (const key of Object.keys(APPS)) {
    const app = APPS[key];
    console.log(`\n--- CLI ${app.name} ---`);

    // Root unauth
    const root = await cliProbe(app.base + "/");
    apiResults.push({ app: app.name, path: "/", phase: "unauth-root", ...root });
    if (root.error || root.status === 0) {
      finding("critical", app.name, "uptime", "Root unreachable", root.body);
    } else if (root.status >= 500) {
      finding("critical", app.name, "uptime", `Root ${root.status}`, root.body.slice(0, 200));
    } else if (root.status === 429) {
      finding("medium", app.name, "rate-limit", "Root rate limited (429)", "May be prior test hammering");
    } else {
      console.log(`  root: ${root.status} ${root.ms}ms`);
    }

    // Security headers on root
    const h = root.headers || {};
    if (!h.csp && root.status > 0 && root.status < 500) {
      finding("low", app.name, "security", "Missing CSP header on root", "");
    }
    if (!h.xcto && root.status > 0 && root.status < 500) {
      finding("low", app.name, "security", "Missing X-Content-Type-Options", "");
    }
    standards.push({
      app: app.name,
      check: "security-headers",
      csp: !!h.csp,
      xcto: !!h.xcto,
      hsts: !!h.hsts,
      status: root.status,
    });

    // Auth
    let cookie = "";
    if (app.auth === "sso") {
      const sso = await ssoCookie(app.base, app.ssoRole);
      console.log(
        `  sso: ${sso.status} loc=${(sso.location || "").slice(0, 80)} cookie=${sso.cookies ? "yes" : "no"}`
      );
      if (sso.status !== 302 && sso.status !== 307 && sso.status !== 303) {
        finding(
          "high",
          app.name,
          "auth",
          `SSO login returned ${sso.status} (expected 302)`,
          sso.location || sso.raw.body?.slice(0, 150)
        );
      }
      if (!sso.cookies) {
        finding("critical", app.name, "auth", "SSO did not set session cookie", sso.location);
      }
      // open-redirect / public origin check
      if (sso.location && /0\.0\.0\.0|127\.0\.0\.1|localhost:\d+/.test(sso.location)) {
        finding(
          "critical",
          app.name,
          "auth",
          "SSO redirect to internal/local origin",
          sso.location
        );
      }
      cookie = sso.cookies;
    } else if (app.auth === "password") {
      const login = await passwordLoginCookie(app.base, app.user, app.pw);
      console.log(
        `  login: ${login.status} cookie=${login.cookies ? "yes" : "no"} ${login.ms}ms`
      );
      if (login.status < 200 || login.status >= 300) {
        // try alternate field names
        try {
          const res2 = await fetch(`${app.base}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ user: app.user, password: app.pw }),
            redirect: "manual",
          });
          const sc = res2.headers.getSetCookie?.() || [];
          cookie = extractCookies(sc);
          console.log(`  login alt: ${res2.status} cookie=${cookie ? "yes" : "no"}`);
          if (!cookie) {
            finding(
              "critical",
              app.name,
              "auth",
              `Password login failed (${login.status})`,
              login.body
            );
          }
        } catch (e) {
          finding("critical", app.name, "auth", "Password login error", String(e.message || e));
        }
      } else {
        cookie = login.cookies;
        if (!cookie) {
          finding("high", app.name, "auth", "Login 2xx but no Set-Cookie", login.body);
        }
      }
    }

    // Auth'd APIs
    for (const api of app.apis) {
      await sleep(200); // soft rate-limit
      const r = await cliProbe(app.base + api, cookie || null);
      apiResults.push({
        app: app.name,
        path: api,
        phase: cookie ? "auth" : "no-cookie",
        status: r.status,
        ms: r.ms,
        ct: r.ct,
        bodyPreview: r.body.slice(0, 300),
      });
      const tag =
        r.status >= 500 ? "✗5xx" : r.status === 401 || r.status === 403 ? "auth" : r.status === 429 ? "429" : "ok";
      console.log(`  API ${api.padEnd(28)} ${r.status} ${r.ms}ms ${tag}`);

      if (r.status >= 500) {
        finding("critical", app.name, "api", `${api} → ${r.status}`, r.body.slice(0, 250));
        if (looksLikeStackLeak(r.body)) {
          finding("high", app.name, "security", `${api} leaks stack in 5xx body`, r.body.slice(0, 200));
        }
      } else if (r.status === 429) {
        finding("medium", app.name, "rate-limit", `${api} rate limited`, "");
      } else if ((r.status === 401 || r.status === 403) && cookie) {
        finding("high", app.name, "auth", `${api} forbidden despite cookie`, r.body.slice(0, 200));
      } else if (r.status === 404) {
        finding("medium", app.name, "api", `${api} not found (404)`, "Route missing or renamed");
      } else if (r.status >= 200 && r.status < 300) {
        // envelope check for JSON APIs
        if (r.ct.includes("application/json")) {
          const j = parseJsonSafe(r.body);
          if (j && j.error && !j.data) {
            // structured error on 2xx is odd
            finding("low", app.name, "api", `${api} 2xx with error envelope`, JSON.stringify(j.error).slice(0, 150));
          }
          if (j && j.error && looksLikeStackLeak(JSON.stringify(j))) {
            finding("high", app.name, "security", `${api} error envelope may leak stack`, "");
          }
        }
      }
    }

    // Unauth API should not leak data for protected endpoints (sample)
    if (app.apis.length && app.auth !== "none") {
      const sample = app.apis.find((a) => !a.includes("/summary") || app.name.includes("erp"));
      // For hr-v1 public summary is allowlisted — skip that one
      const protectedSample =
        app.name === "ykp-hr-v1"
          ? "/api/hr/employees"
          : app.apis.find((a) => a.includes("/auth/me")) || app.apis[0];
      const unauth = await cliProbe(app.base + protectedSample, null);
      apiResults.push({
        app: app.name,
        path: protectedSample,
        phase: "unauth-protected",
        status: unauth.status,
        ms: unauth.ms,
      });
      if (unauth.status >= 200 && unauth.status < 300) {
        // /api/hr/summary on hr-v1 is public by design
        if (!(app.name === "ykp-hr-v1" && protectedSample.includes("/summary"))) {
          finding(
            "high",
            app.name,
            "security",
            `${protectedSample} accessible without auth (${unauth.status})`,
            unauth.body.slice(0, 150)
          );
        }
      } else {
        console.log(`  unauth gate ${protectedSample}: ${unauth.status} ✓`);
      }
    }
  }
}

async function phaseBrowser() {
  console.log("\n========== PHASE 2: FRONTEND CLICK-THROUGH ==========\n");

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  for (const key of Object.keys(APPS)) {
    const app = APPS[key];
    console.log(`\n=== UI ${app.name} ===`);
    const ctx = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const net5xx = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on("response", (r) => {
      if (r.status() >= 500) net5xx.push(`${r.status()} ${r.url()}`);
    });

    // Auth into app
    if (app.auth === "sso") {
      const ssoUrl = `${app.base}/api/auth/login?role=${encodeURIComponent(app.ssoRole)}&redirect=/`;
      try {
        const resp = await page.goto(ssoUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(2500);
        console.log(`  SSO land: ${resp?.status()} url=${page.url().replace(app.base, "")}`);
        if (page.url().includes("0.0.0.0") || page.url().includes("ERR_")) {
          finding("critical", app.name, "auth-ui", "SSO landed on invalid origin", page.url());
        }
      } catch (e) {
        finding("critical", app.name, "auth-ui", "SSO navigation failed", String(e.message || e).slice(0, 200));
      }
    } else if (app.auth === "password") {
      try {
        await page.goto(app.base + "/login", { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(1500);
        const user = page.locator('input[type="text"], input[name="username"], input[name="user"], input').first();
        const pw = page.locator('input[type="password"]').first();
        if ((await user.count()) > 0 && (await pw.count()) > 0) {
          await user.fill(app.user);
          await pw.fill(app.pw);
          const submit = page.locator('button[type="submit"]').first();
          const loginP = page
            .waitForResponse((r) => r.url().includes("/api/auth/login"), { timeout: 20000 })
            .catch(() => null);
          await submit.click();
          const lr = await loginP;
          await sleep(2500);
          console.log(`  password login: ${lr?.status()} url=${page.url().replace(app.base, "")}`);
          if (page.url().includes("/login")) {
            finding("critical", app.name, "auth-ui", "Still on /login after submit", `status=${lr?.status()}`);
          }
        } else {
          finding("critical", app.name, "auth-ui", "Login form inputs not found", "");
        }
      } catch (e) {
        finding("critical", app.name, "auth-ui", "Login flow error", String(e.message || e).slice(0, 200));
      }
    }

    // Visit each page, click buttons one by one
    for (const p of app.pages) {
      consoleErrors.length = 0;
      pageErrors.length = 0;
      net5xx.length = 0;
      let status = 0;
      let title = "";
      let bodyText = "";
      let buttons = [];
      let inputs = 0;
      let errorVisible = 0;
      let emptyState = false;
      let finalUrl = "";

      try {
        const resp = await page.goto(app.base + p, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        status = resp?.status() ?? 0;
        await sleep(2200);
        finalUrl = page.url();
        title = await page.title().catch(() => "");
        bodyText = await page.locator("body").innerText().catch(() => "");
        inputs = await page.locator("input, select, textarea").count();
        errorVisible = await page.locator("text=/error|gagal|forbidden|unauthorized|rate.?limit|too many/i").count();
        emptyState =
          /belum ada data|no data|empty|tidak ada data|0 records/i.test(bodyText) ||
          bodyText.trim().length < 40;

        // Collect visible buttons
        buttons = await page.evaluate(() => {
          const els = Array.from(
            document.querySelectorAll("button, a[role='button'], [role='button']")
          );
          return els
            .map((b) => {
              const r = b.getBoundingClientRect();
              const cs = getComputedStyle(b);
              const visible =
                r.width > 0 &&
                r.height > 0 &&
                cs.display !== "none" &&
                cs.visibility !== "hidden";
              return {
                text: (b.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
                disabled: !!b.disabled || b.getAttribute("aria-disabled") === "true",
                visible,
              };
            })
            .filter((b) => b.visible && b.text);
        });

        const shot = path.join(
          SHOTS,
          `${app.name}${p.replace(/[^a-z0-9]+/gi, "_") || "_root"}.png`
        );
        await page.screenshot({ path: shot, fullPage: false }).catch(() => null);

        const row = {
          app: app.name,
          path: p,
          status,
          finalUrl: finalUrl.replace(app.base, ""),
          title,
          buttons: buttons.length,
          buttonLabels: buttons.map((b) => b.text).slice(0, 20),
          inputs,
          errorVisible,
          emptyState,
          consoleErrors: [...consoleErrors],
          pageErrors: [...pageErrors],
          net5xx: [...net5xx],
          bodySnippet: bodyText.slice(0, 250).replace(/\s+/g, " "),
          shot,
        };
        pageResults.push(row);

        console.log(
          `  ${p.padEnd(28)} HTTP${status} btn=${buttons.length} in=${inputs} errTxt=${errorVisible} empty=${emptyState} cErr=${consoleErrors.length} 5xx=${net5xx.length}`
        );

        if (status >= 500) {
          finding("critical", app.name, "page", `${p} HTTP ${status}`, bodyText.slice(0, 150), {
            shot,
          });
        } else if (status === 404) {
          finding("high", app.name, "page", `${p} 404`, "Route missing", { shot });
        } else if (status === 429) {
          finding("medium", app.name, "rate-limit", `${p} rate limited in browser`, "", { shot });
        }

        // Login page should exist for ykp-erp (even if role-picker)
        if (p === "/login" && status >= 200 && status < 400) {
          if (inputs === 0 && buttons.length === 0) {
            finding("medium", app.name, "auth-ui", "/login has no inputs/buttons", bodyText.slice(0, 120), {
              shot,
            });
          }
        }

        // For authenticated dashboard pages: if redirected to login unexpectedly
        if (
          app.auth !== "none" &&
          p !== "/login" &&
          finalUrl.includes("/login") &&
          !p.includes("login")
        ) {
          finding(
            "high",
            app.name,
            "auth-ui",
            `${p} redirected to login (session lost?)`,
            finalUrl,
            { shot }
          );
        }

        if (net5xx.length) {
          finding("critical", app.name, "page", `${p} triggered ${net5xx.length} 5xx network`, net5xx.slice(0, 3).join(" | "), {
            shot,
          });
        }
        if (pageErrors.length) {
          finding("high", app.name, "page", `${p} pageerror`, pageErrors[0], { shot });
        }

        // Click each button one-by-one (max 12 per page to bound runtime)
        const clickTargets = buttons.filter((b) => !b.disabled).slice(0, 12);
        for (const btn of clickTargets) {
          // skip pure navigation that would leave app
          if (/logout|keluar|sign out/i.test(btn.text) && app.auth === "password") {
            // still record existence but don't logout mid-run
            clickResults.push({
              app: app.name,
              path: p,
              button: btn.text,
              action: "skipped-logout",
              ok: true,
            });
            continue;
          }

          const beforeUrl = page.url();
          const beforeHtmlLen = await page.evaluate(() => document.body?.innerHTML?.length || 0);
          const netCalls = [];
          const onResp = (r) => {
            if (r.url().includes("/api/")) netCalls.push({ url: r.url(), status: r.status() });
          };
          page.on("response", onResp);

          let clickOk = false;
          let effect = "none";
          try {
            // re-find by text each time (DOM may have re-rendered)
            clickOk = await page.evaluate((txt) => {
              const els = Array.from(
                document.querySelectorAll("button, a[role='button'], [role='button']")
              );
              const match = els.find((b) => {
                const r = b.getBoundingClientRect();
                const cs = getComputedStyle(b);
                const vis =
                  r.width > 0 &&
                  r.height > 0 &&
                  cs.display !== "none" &&
                  cs.visibility !== "hidden";
                return vis && (b.textContent || "").trim().replace(/\s+/g, " ").includes(txt);
              });
              if (!match) return false;
              match.click();
              return true;
            }, btn.text);
            await sleep(1800);

            const afterUrl = page.url();
            const afterHtmlLen = await page.evaluate(() => document.body?.innerHTML?.length || 0);
            const dialogOpen = await page.evaluate(
              () =>
                !!document.querySelector(
                  '[role="dialog"]:not([data-state="closed"]), [data-state="open"][role="dialog"], .modal, [aria-modal="true"]'
                )
            );
            if (afterUrl !== beforeUrl) effect = "nav";
            else if (dialogOpen) effect = "dialog";
            else if (netCalls.length) effect = "api";
            else if (Math.abs(afterHtmlLen - beforeHtmlLen) > 50) effect = "dom";

            // close dialog if open so next clicks work
            if (dialogOpen) {
              await page.keyboard.press("Escape").catch(() => null);
              await sleep(400);
              // click cancel/tutup if still open
              await page.evaluate(() => {
                const cancel = Array.from(document.querySelectorAll("button")).find((b) =>
                  /batal|cancel|tutup|close|×/i.test(b.textContent || "")
                );
                cancel?.click();
              });
              await sleep(300);
            }

            // if navigated away from current path, go back
            if (afterUrl !== beforeUrl && !afterUrl.includes(p === "/" ? app.base + "/" : p)) {
              await page.goto(beforeUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
              await sleep(1000);
            }
          } catch (e) {
            effect = `err:${String(e.message || e).slice(0, 80)}`;
          } finally {
            page.off("response", onResp);
          }

          const api5 = netCalls.filter((c) => c.status >= 500);
          const ok = clickOk && api5.length === 0;
          clickResults.push({
            app: app.name,
            path: p,
            button: btn.text,
            clickOk,
            effect,
            apiCalls: netCalls.length,
            api5xx: api5.length,
            ok,
          });
          if (!clickOk) {
            finding(
              "medium",
              app.name,
              "button",
              `${p} button not clickable: "${btn.text}"`,
              "DOM re-render or hidden"
            );
          } else if (api5.length) {
            finding(
              "critical",
              app.name,
              "button",
              `${p} "${btn.text}" → API 5xx`,
              api5.map((a) => `${a.status} ${a.url}`).join(" | ")
            );
          } else if (effect === "none" && !/refresh|reload|filter|cari|search|tutup|cancel|batal/i.test(btn.text)) {
            // inert button is a UX bug if it claims action
            if (/tambah|simpan|approve|reject|generate|rebuild|kirim|submit|save|buat|run|mark/i.test(btn.text)) {
              finding(
                "medium",
                app.name,
                "button",
                `${p} "${btn.text}" click had no visible effect`,
                "No dialog/nav/api/dom change — possible missing handler (Phase 4 approval UI?)"
              );
            }
          } else {
            console.log(`    click "${btn.text.slice(0, 40)}" → ${effect} api=${netCalls.length}`);
          }
        }
      } catch (e) {
        finding("critical", app.name, "page", `${p} navigation crashed`, String(e.message || e).slice(0, 200));
        pageResults.push({
          app: app.name,
          path: p,
          status: 0,
          error: String(e.message || e).slice(0, 200),
        });
      }
    }

    // Known-issue probes for hr-v1
    if (app.name === "ykp-hr-v1") {
      // leaves employee dropdown
      try {
        await page.goto(app.base + "/hr/leaves", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(1500);
        // open add dialog if present
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("button")).find((x) =>
            /tambah|ajukan|baru|add|new/i.test(x.textContent || "")
          );
          b?.click();
        });
        await sleep(1200);
        const selectOpts = await page.evaluate(() => {
          const sels = Array.from(document.querySelectorAll("select"));
          return sels.map((s) => ({
            name: s.name || s.id || "",
            options: Array.from(s.options).map((o) => o.textContent?.trim()).filter(Boolean).slice(0, 10),
            count: s.options.length,
          }));
        });
        const emptyEmp = selectOpts.some(
          (s) =>
            /employee|karyawan|emp/i.test(s.name) ||
            s.options.some((o) => /pilih|select/i.test(o))
        );
        const anyHasEmployees = selectOpts.some((s) => s.count > 1);
        if (selectOpts.length && !anyHasEmployees) {
          finding(
            "high",
            app.name,
            "known-issue",
            "Leaves form: employee dropdown empty / not loaded",
            JSON.stringify(selectOpts).slice(0, 250)
          );
        } else {
          console.log(`  leaves dropdowns: ${JSON.stringify(selectOpts).slice(0, 200)}`);
        }
        await page.keyboard.press("Escape").catch(() => null);
      } catch (e) {
        /* ignore */
      }

      // adjustments same
      try {
        await page.goto(app.base + "/hr/adjustments", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await sleep(1200);
        await page.evaluate(() => {
          const b = Array.from(document.querySelectorAll("button")).find((x) =>
            /tambah|ajukan|baru|add|new/i.test(x.textContent || "")
          );
          b?.click();
        });
        await sleep(1000);
        const selectOpts = await page.evaluate(() => {
          const sels = Array.from(document.querySelectorAll("select"));
          return sels.map((s) => ({
            name: s.name || s.id || "",
            count: s.options.length,
          }));
        });
        const anyHas = selectOpts.some((s) => s.count > 1);
        if (selectOpts.length && !anyHas) {
          finding(
            "high",
            app.name,
            "known-issue",
            "Adjustments form: employee dropdown empty / not loaded",
            JSON.stringify(selectOpts).slice(0, 200)
          );
        }
      } catch {
        /* ignore */
      }

      // approval buttons presence on leaves/adjustments/payroll
      for (const pathCheck of ["/hr/leaves", "/hr/adjustments", "/hr/payroll"]) {
        try {
          await page.goto(app.base + pathCheck, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await sleep(1500);
          const labels = await page.evaluate(() =>
            Array.from(document.querySelectorAll("button"))
              .map((b) => (b.textContent || "").trim().toLowerCase())
              .filter(Boolean)
          );
          const hasApprove = labels.some((t) => /approve|setujui|terima/.test(t));
          const hasReject = labels.some((t) => /reject|tolak/.test(t));
          const hasMarkPaid = labels.some((t) => /mark.?paid|bayar|paid|lunas/.test(t));
          console.log(
            `  approval scan ${pathCheck}: approve=${hasApprove} reject=${hasReject} markPaid=${hasMarkPaid} labels=${labels.slice(0, 8).join("|")}`
          );
          if (pathCheck !== "/hr/payroll" && !hasApprove) {
            finding(
              "high",
              app.name,
              "phase4-gap",
              `${pathCheck}: no Approve button visible`,
              "PROGRESS: Phase 4 approval UI not wired"
            );
          }
          if (pathCheck !== "/hr/payroll" && !hasReject) {
            finding(
              "high",
              app.name,
              "phase4-gap",
              `${pathCheck}: no Reject button visible`,
              "PROGRESS: Phase 4 approval UI not wired"
            );
          }
          if (pathCheck === "/hr/payroll" && !hasApprove && !hasMarkPaid) {
            finding(
              "high",
              app.name,
              "phase4-gap",
              `/hr/payroll: no Approve / Mark-paid button visible`,
              "PROGRESS: Phase 4 approval UI not wired"
            );
          }
        } catch {
          /* ignore */
        }
      }

      // logout button
      try {
        await page.goto(app.base + "/hr", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(1000);
        const hasLogout = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button, a")).some((el) =>
            /logout|keluar|sign out/i.test(el.textContent || "")
          )
        );
        if (!hasLogout) {
          finding(
            "medium",
            app.name,
            "phase5-gap",
            "Sidebar logout button missing",
            "PROGRESS Phase 5"
          );
        }
      } catch {
        /* ignore */
      }
    }

    // Finance: rebuild today / dashboard cards
    if (app.name === "ykp-erp-finance") {
      try {
        await page.goto(app.base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(2000);
        const text = await page.locator("body").innerText();
        const allZero = (text.match(/Rp\s*0/g) || []).length >= 4;
        if (allZero) {
          finding(
            "medium",
            app.name,
            "data",
            "Finance dashboard shows many Rp 0 cards",
            "May be empty today without rebuild — check fallback to latest day (ec0e865)"
          );
        }
        await page.goto(app.base + "/summary", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(1500);
        const hasRebuild = await page.evaluate(() =>
          Array.from(document.querySelectorAll("button")).some((b) =>
            /rebuild/i.test(b.textContent || "")
          )
        );
        if (!hasRebuild) {
          finding("medium", app.name, "page", "/summary missing Rebuild Today button", "");
        }
      } catch {
        /* ignore */
      }
    }

    // Hermez write-back boundary probe (should not expose write APIs casually)
    if (app.name === "ykp-erp-hermez") {
      try {
        await page.goto(app.base + "/config", { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(1500);
        const body = await page.locator("body").innerText();
        if (/writeback|write-back|HERMEZ_WRITEBACK/i.test(body)) {
          console.log("  hermez config surfaces writeback flag (ok for owner)");
        }
      } catch {
        /* ignore */
      }
    }

    await ctx.close();
    await sleep(800);
  }

  await browser.close();
}

async function phaseLocalTests() {
  console.log("\n========== PHASE 3: LOCAL UNIT TESTS ==========\n");
  const { spawnSync } = await import("node:child_process");

  // orchestrator tests
  const orch = spawnSync("npm", ["test", "--", "--run"], {
    cwd: "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/orchestrator",
    encoding: "utf8",
    shell: true,
    timeout: 120000,
  });
  const orchOk = orch.status === 0;
  standards.push({
    app: "orchestrator",
    check: "vitest",
    ok: orchOk,
    exit: orch.status,
    tail: (orch.stdout || orch.stderr || "").slice(-800),
  });
  console.log(`  orchestrator vitest: ${orchOk ? "PASS" : "FAIL"} exit=${orch.status}`);
  if (!orchOk) {
    finding(
      "high",
      "orchestrator",
      "tests",
      "Unit tests failed",
      (orch.stdout || orch.stderr || "").slice(-400)
    );
  }

  // hr-v1 tests
  const hrv1 = spawnSync("npm", ["test", "--", "--run"], {
    cwd: "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/ykp-hr-v1",
    encoding: "utf8",
    shell: true,
    timeout: 120000,
  });
  const hrOk = hrv1.status === 0;
  standards.push({
    app: "ykp-hr-v1",
    check: "vitest",
    ok: hrOk,
    exit: hrv1.status,
    tail: (hrv1.stdout || hrv1.stderr || "").slice(-800),
  });
  console.log(`  ykp-hr-v1 vitest: ${hrOk ? "PASS" : "FAIL"} exit=${hrv1.status}`);
  if (!hrOk) {
    finding(
      "high",
      "ykp-hr-v1",
      "tests",
      "Unit tests failed",
      (hrv1.stdout || hrv1.stderr || "").slice(-400)
    );
  }

  // ykp-erp tests if present
  const erp = spawnSync("npm", ["test", "--", "--run"], {
    cwd: "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/ykp-erp",
    encoding: "utf8",
    shell: true,
    timeout: 180000,
  });
  const erpOk = erp.status === 0;
  standards.push({
    app: "ykp-erp",
    check: "vitest",
    ok: erpOk,
    exit: erp.status,
    tail: (erp.stdout || erp.stderr || "").slice(-800),
  });
  console.log(`  ykp-erp vitest: ${erpOk ? "PASS" : "FAIL"} exit=${erp.status}`);
  if (!erpOk) {
    finding(
      "medium",
      "ykp-erp",
      "tests",
      "Workspace tests failed or not configured",
      (erp.stdout || erp.stderr || "").slice(-400)
    );
  }
}

function summarize() {
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) bySev[f.severity] = (bySev[f.severity] || 0) + 1;

  const pageOk = pageResults.filter((p) => p.status >= 200 && p.status < 400).length;
  const pageTotal = pageResults.length;
  const clickOk = clickResults.filter((c) => c.ok).length;
  const clickTotal = clickResults.length;
  const apiOk = apiResults.filter(
    (a) => a.status >= 200 && a.status < 500 && a.status !== 0
  ).length;
  const apiTotal = apiResults.length;

  const report = {
    generatedAt: new Date().toISOString(),
    goal: "Deep verify PROGRESS_STATUS features: exists / works / production / bugs",
    method: ["CLI HTTP", "Playwright click-one-by-one", "local vitest"],
    summary: {
      findings: bySev,
      findingsTotal: findings.length,
      pages: { ok: pageOk, total: pageTotal },
      clicks: { ok: clickOk, total: clickTotal },
      apis: { ok: apiOk, total: apiTotal },
      unitTests: standards.filter((s) => s.check === "vitest"),
    },
    productionGate: {
      noCritical5xx: bySev.critical === 0,
      authWorks: !findings.some((f) => f.area.startsWith("auth") && (f.severity === "critical" || f.severity === "high")),
      noStackLeak: !findings.some((f) => f.title.includes("stack")),
      unitTestsGreen: standards.filter((s) => s.check === "vitest").every((s) => s.ok),
      phase4ApprovalUi: !findings.some((f) => f.area === "phase4-gap"),
      realData: false, // mock — from PROGRESS_STATUS
      pilot7day: false,
    },
    findings: findings.sort((a, b) => {
      const o = { critical: 0, high: 1, medium: 2, low: 3 };
      return (o[a.severity] ?? 9) - (o[b.severity] ?? 9);
    }),
    pageResults,
    clickResults,
    apiResults,
    standards,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log("\n========== SUMMARY ==========");
  console.log(`Findings: crit=${bySev.critical} high=${bySev.high} med=${bySev.medium} low=${bySev.low}`);
  console.log(`Pages: ${pageOk}/${pageTotal}  Clicks: ${clickOk}/${clickTotal}  APIs: ${apiOk}/${apiTotal}`);
  console.log(`Production gate:`, report.productionGate);
  console.log(`JSON: ${OUT}`);
  console.log(`Shots: ${SHOTS}`);
  return report;
}

async function main() {
  await phaseCli();
  await phaseBrowser();
  await phaseLocalTests();
  summarize();
}

main().catch((e) => {
  console.error("FATAL", e);
  fs.writeFileSync(
    OUT,
    JSON.stringify({ fatal: String(e.stack || e), findings, pageResults, apiResults }, null, 2)
  );
  process.exit(2);
});
