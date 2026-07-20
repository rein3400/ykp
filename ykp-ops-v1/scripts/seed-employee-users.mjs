/**
 * Seed user accounts for employees (karyawan).
 * Creates 1 user per employee in `master_employee`.
 *
 * Security: no hardcoded password. Use EMPLOYEE_DEFAULT_PASSWORD env var,
 * or a random 12-character password is generated and printed once per user.
 */
import { google } from "googleapis";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const CRED_PATH = "D:/Users/stefa/Downloads/ykp-hr-v1-7786e7ed8655.json";
const SHEET_ID = "1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg";

function generatePassword(length = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const bytes = randomBytes(length);
  let pw = "";
  for (let i = 0; i < length; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw;
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

  const empResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "master_employee!A1:V20",
  });
  const employees = (empResp.data.values || []).slice(1);
  console.log(`Found ${employees.length} employees`);

  const userResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "users!A1:J20",
  });
  const existingUsernames = new Set(
    (userResp.data.values || []).slice(1).map((r) => r[1])
  );

  const explicitDefault = process.env.EMPLOYEE_DEFAULT_PASSWORD;
  const generated = !explicitDefault;
  const defaultPassword = explicitDefault ?? generatePassword();
  if (!generated && defaultPassword.length < 12) {
    console.error("ERROR: EMPLOYEE_DEFAULT_PASSWORD must be at least 12 characters");
    process.exit(1);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const newRows = [];
  const printed = [];
  employees.forEach((emp, idx) => {
    const id = emp[0];
    const fullName = emp[2];
    const nickname = emp[3];
    const role = (emp[14] || "staff").toLowerCase();
    const brandId = emp[16] || "";
    const outletId = emp[17] || "";
    const firstName = (nickname || fullName.split(" ")[0]).toLowerCase().replace(/[^a-z]/g, "");
    const username = `${firstName}.emp${idx + 1}`;
    if (existingUsernames.has(username)) return;
    const userId = `U-EMP-${idx + 1}`;
    const userRole = ROLE_MAP[role] || "employee";
    const password = generated ? generatePassword() : defaultPassword;
    newRows.push({
      user_id: userId,
      username,
      password_hash: bcrypt.hashSync(password, 10),
      role: userRole.toUpperCase(),
      brand_id: brandId,
      outlet_id: outletId,
      active_status: "active",
      created_at: now,
      last_login_at: "",
    });
    printed.push({ username, password });
  });

  if (newRows.length === 0) {
    console.log("No new users to add");
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "users!A2:I2",
    valueInputOption: "RAW",
    requestBody: { values: newRows.map((r) => Object.values(r)) },
  });
  console.log(`Added ${newRows.length} employee users`);
  if (generated) {
    console.log("=== GENERATED EMPLOYEE PASSWORDS ===");
    for (const p of printed) {
      console.log(`  ${p.username}: ${p.password}`);
    }
    console.log("====================================");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
