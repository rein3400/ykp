/**
 * Seed user accounts for employees (karyawan).
 * Creates 1 user per employee in `master_employee`.
 * Username: lowercase firstname.emp{N}
 * Password: emp123 (change in production)
 * Role: based on employee role
 *
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
 *   set YKP_HR_SPREADSHEET_ID=<spreadsheet-id>
 *   node scripts/seed-employee-users.mjs
 *
 * Both env vars are required (no hardcoded paths — see .env for the same keys).
 */
import { google } from "googleapis";
import bcrypt from "bcryptjs";
import fs from "node:fs";

const CRED_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const SHEET_ID = process.env.YKP_HR_SPREADSHEET_ID;

if (!CRED_PATH || !fs.existsSync(CRED_PATH)) {
  console.error(
    "ERROR: set GOOGLE_APPLICATION_CREDENTIALS to a readable service-account JSON path.\n" +
    `  Got: ${CRED_PATH ?? "(unset)"}`
  );
  process.exit(1);
}
if (!SHEET_ID) {
  console.error("ERROR: set YKP_HR_SPREADSHEET_ID to the HR spreadsheet ID.");
  process.exit(1);
}

function hashPw(p) {
  return bcrypt.hashSync(p, 10);
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
      must_change_password: "true",
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
    range: "users!A2:M2",
    valueInputOption: "RAW",
    requestBody: { values: newRows.map((r) => Object.values(r)) },
  });
  console.log(`Added ${newRows.length} employee users`);
  for (const r of newRows) {
    console.log(`  ${r.username} / emp123 (${r.role})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
