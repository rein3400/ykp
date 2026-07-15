/**
 * Seed user accounts for employees (karyawan).
 * Creates 1 user per employee in `master_employee`.
 * Username: lowercase firstname.emp{N}
 * Password: emp123 (change in production)
 * Role: based on employee role
 *
 * Usage: node scripts/seed-employee-users.mjs
 */
import { google } from "googleapis";
import { createHash } from "node:crypto";
import fs from "node:fs";

const CRED_PATH = "D:/Users/stefa/Downloads/ykp-hr-v1-7786e7ed8655.json";
const SHEET_ID = "1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg";

function hashPw(p) {
  return createHash("sha256").update(p).digest("hex");
}

const ROLE_MAP = {
  staff: "employee",
  supervisor: "supervisor",
  outlet_manager: "outlet_manager",
  brand_manager: "brand_manager",
  hr_admin: "hr_admin",
};

async function main() {
  const creds = JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // Read master_employee
  const empResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "master_employee!A1:V20",
  });
  const employees = (empResp.data.values || []).slice(1);
  console.log(`Found ${employees.length} employees`);

  // Read existing users
  const userResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "users!A1:J20",
  });
  const existingUsernames = new Set(
    (userResp.data.values || []).slice(1).map((r) => r[1])
  );

  // Build user rows
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const newRows = [];
  employees.forEach((emp, idx) => {
    const id = emp[0];
    const fullName = emp[2];
    const nickname = emp[3];
    const role = (emp[14] || "staff").toLowerCase();
    const brandId = emp[16] || "";
    const outletId = emp[17] || "";
    // Username: firstname.empN (lowercase, dots)
    const firstName = (nickname || fullName.split(" ")[0]).toLowerCase().replace(/[^a-z]/g, "");
    const username = `${firstName}.emp${idx + 1}`;
    if (existingUsernames.has(username)) return;
    const userId = `U-EMP-${idx + 1}`;
    const userRole = ROLE_MAP[role] || "employee";
    newRows.push({
      user_id: userId,
      username,
      password_hash: hashPw("emp123"),
      role: userRole.toUpperCase(),
      brand_id: brandId,
      outlet_id: outletId,
      active_status: "active",
      created_at: now,
      last_login_at: "",
    });
  });

  if (newRows.length === 0) {
    console.log("No new users to add");
    return;
  }

  // Get next row
  const appendResp = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "users!A2:I2",
    valueInputOption: "RAW",
    requestBody: { values: newRows.map((r) => Object.values(r)) },
  });
  console.log(`Added ${newRows.length} employee users`);
  for (const r of newRows) {
    console.log(`  ${r.username} / emp123 (${r.role})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
