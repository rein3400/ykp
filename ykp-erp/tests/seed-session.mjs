// Generate signed session JWT for owner role.
// Used by Playwright tests to bypass auth gate.
import { createHmac, randomBytes } from "node:crypto";

const SECRET = "ykp-erp-pilot-session-secret-change-me-to-32+chars-please";
const COOKIE_NAME = "ykp_session";

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(`${header}.${body}`).digest();
  return `${header}.${body}.${b64url(sig)}`;
}

const ownerToken = sign({
  id: "U-001",
  email: "owner@ykp.local",
  name: "Owner",
  role: "OWNER", // must match Role enum (uppercase) in packages/auth/src/roles.ts
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  jti: randomBytes(8).toString("hex"),
});

console.log(`Cookie ${COOKIE_NAME}=${ownerToken}`);
console.log(`\nUse in Playwright: page.context().addCookies([{name:"${COOKIE_NAME}", value: ${JSON.stringify(ownerToken)}, domain:".railway.app", path:"/"}])`);