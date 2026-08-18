/**
 * CLI recheck with correct route paths (from source tree).
 */
const APPS = [
  {
    name: "finance",
    base: "https://ykp-erp-finance-production.up.railway.app",
    sso: "OWNER",
    apis: [
      "/api/fin/summary",
      "/api/fin/pos",
      "/api/fin/expense",
      "/api/fin/petty-cash",
      "/api/fin/supplier",
      "/api/fin/master-data",
      "/api/fin/unpaid",
      "/api/fin/analytics/revenue",
      "/api/fin/analytics/profit",
      "/api/fin/closing-cash",
      "/api/fin/export/csv",
    ],
  },
  {
    name: "hermez",
    base: "https://ykp-erp-hermez-production.up.railway.app",
    sso: "SUPER_ADMIN",
    apis: [
      "/api/hermez/config",
      "/api/hermez/brief",
      "/api/hermez/alerts",
      "/api/hermez/run",
      "/api/hermez/telegram/test",
    ],
  },
  {
    name: "hr",
    base: "https://ykp-erp-hr-production.up.railway.app",
    sso: "OWNER",
    apis: [
      "/api/hr/summary",
      "/api/hr/employees",
      "/api/hr/attendance",
      "/api/hr/payroll",
      "/api/hr/rules",
    ],
  },
  {
    name: "hr-v1",
    base: "https://ykp-hr-v1-standalone-production.up.railway.app",
    password: { username: "owner", password: "owner123" },
    apis: [
      "/api/hr/summary",
      "/api/hr/employees",
      "/api/hr/attendance",
      "/api/hr/leaves",
      "/api/hr/adjustments",
      "/api/hr/roster",
      "/api/hr/payroll/generate",
      "/api/hr/payroll/approve",
      "/api/hr/payroll/mark-paid",
      "/api/hr/leaves/approve",
      "/api/hr/adjustments/approve",
      "/api/hr/summary/count",
      "/api/auth/logout",
    ],
  },
];

async function sso(base, role) {
  const res = await fetch(`${base}/api/auth/login?role=${role}&redirect=/`, {
    redirect: "manual",
  });
  const cookies = (res.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: res.status, cookies, loc: res.headers.get("location") };
}

async function passwordLogin(base, creds) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(creds),
    redirect: "manual",
  });
  const cookies = (res.headers.getSetCookie?.() || [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: res.status, cookies };
}

async function probe(base, path, cookie, method = "GET") {
  const t0 = Date.now();
  const res = await fetch(base + path, {
    method,
    headers: {
      Accept: "application/json",
      Cookie: cookie || "",
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify({}),
    redirect: "manual",
  });
  const body = (await res.text()).slice(0, 220).replace(/\s+/g, " ");
  return { path, status: res.status, ms: Date.now() - t0, body };
}

const out = [];
for (const app of APPS) {
  console.log(`\n=== ${app.name} ===`);
  let cookie = "";
  if (app.sso) {
    const s = await sso(app.base, app.sso);
    cookie = s.cookies;
    console.log(`SSO ${s.status} cookie=${!!cookie} loc=${s.loc}`);
  } else {
    const s = await passwordLogin(app.base, app.password);
    cookie = s.cookies;
    console.log(`login ${s.status} cookie=${!!cookie}`);
  }
  // unauth sample
  const protectedPath = app.apis[1] || app.apis[0];
  const unauth = await probe(app.base, protectedPath, null);
  console.log(`unauth ${protectedPath} → ${unauth.status}`);
  out.push({ app: app.name, kind: "unauth", ...unauth });

  for (const a of app.apis) {
    // POST endpoints that require body: skip mutating approve/mark-paid/generate with empty unless GET allowed
    const method = /approve|mark-paid|generate|logout|run|telegram\/test/.test(a)
      ? "POST"
      : "GET";
    // for generate/approve empty body may 400 — that's OK (route exists)
    const r = await probe(app.base, a, cookie, method === "POST" && a.includes("logout") ? "POST" : method);
    // logout is POST without body ok
    console.log(`${r.status} ${String(r.ms).padStart(5)}ms ${a} :: ${r.body.slice(0, 100)}`);
    out.push({ app: app.name, kind: "auth", method, ...r });
    await new Promise((r) => setTimeout(r, 150));
  }
}

import fs from "node:fs";
fs.writeFileSync(
  "D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER/tests/deep-verify-api-correct.json",
  JSON.stringify(out, null, 2)
);
console.log("\nWrote deep-verify-api-correct.json");
