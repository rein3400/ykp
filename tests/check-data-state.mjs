/**
 * Quick check: see what data deployed apps show.
 * Sign JWT for owner role, hit key API endpoints, report counts.
 */
import { createHmac } from "node:crypto";

const SECRET = "ykp-erp-pilot-session-secret-change-me-to-32+chars-please";
const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
const body = Buffer.from(JSON.stringify({
  id: "U-CHECK", email: "check@ykp.local", name: "Check", role: "OWNER",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400
})).toString("base64url");
const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest("base64url");
const TOKEN = `${header}.${body}.${sig}`;

const APIS = [
  { name: "finance", base: "https://ykp-erp-finance-production.up.railway.app", path: "/api/fin/master-data?kind=brands" },
  { name: "finance", base: "https://ykp-erp-finance-production.up.railway.app", path: "/api/fin/master-data?kind=outlets" },
  { name: "finance", base: "https://ykp-erp-finance-production.up.railway.app", path: "/api/fin/summary" },
  { name: "hr", base: "https://ykp-erp-hr-production.up.railway.app", path: "/api/hr/employees" },
  { name: "hr", base: "https://ykp-erp-hr-production.up.railway.app", path: "/api/hr/payroll" },
  { name: "hr", base: "https://ykp-erp-hr-production.up.railway.app", path: "/api/hr/attendance" },
  { name: "hermez", base: "https://ykp-erp-hermez-production.up.railway.app", path: "/api/hermez/brief?date=2026-07-10" },
  { name: "hermez", base: "https://ykp-erp-hermez-production.up.railway.app", path: "/api/hermez/alerts" },
];

for (const api of APIS) {
  try {
    const r = await fetch(`${api.base}${api.path}`, { headers: { Cookie: `ykp_session=${TOKEN}` } });
    const txt = await r.text();
    let count = "?";
    try {
      const j = JSON.parse(txt);
      const d = j.data ?? j;
      if (Array.isArray(d)) count = String(d.length);
      else if (d.items) count = String(d.items.length);
      else if (d.count != null) count = String(d.count);
      else if (d.alerts) count = String(d.alerts.length);
    } catch { count = "?"; }
    console.log(`${api.name.padEnd(8)} ${api.path.padEnd(50)} status=${r.status} count=${count}`);
  } catch (e) {
    console.log(`${api.name} ${api.path} ERR: ${e.message}`);
  }
}
