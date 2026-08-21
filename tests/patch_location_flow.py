import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

BASE = "/home/dev/ykp/ykp-hr-v1"

def apply(path, replacements):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=30)
    sftp = c.open_sftp()
    with sftp.open(path, "r") as f:
        content = f.read().decode("utf-8")
    for old, new in replacements:
        n = content.count(old)
        if n != 1:
            print(f"FAIL {path}: pattern count={n} for: {old[:70]!r}")
            sftp.close(); c.close()
            return False
        content = content.replace(old, new)
    with sftp.open(path, "w") as f:
        f.write(content)
    sftp.close(); c.close()
    print(f"OK {path}")
    return True

# 1. route.ts — add location handler before intent parsing
ok1 = apply(f"{BASE}/src/app/api/hr/attendance/telegram/route.ts", [
    (
        "  // Resolve linked user account (users.employee_id) for a real RBAC actor.\n  let actorUserId = `TG-${chatId}`;\n  let actorRole = 'employee';\n  const userRow = await findRow(TABS.users, 'employee_id', employee.employee_id);\n  if (userRow) {\n    actorUserId = userRow.row.user_id;\n    actorRole = (userRow.row.role ?? 'employee').toLowerCase();\n  }\n\n  const intent = parseAbsenIntent(msg.text);",
        "  // Resolve linked user account (users.employee_id) for a real RBAC actor.\n  let actorUserId = `TG-${chatId}`;\n  let actorRole = 'employee';\n  const userRow = await findRow(TABS.users, 'employee_id', employee.employee_id);\n  if (userRow) {\n    actorUserId = userRow.row.user_id;\n    actorRole = (userRow.row.role ?? 'employee').toLowerCase();\n  }\n\n  // A shared Telegram location is the clock-in trigger (stateless — no\n  // pending-state needed). Radius check runs inside performClockIn.\n  if (msg.location) {\n    const result = await performClockIn({\n      employeeId: employee.employee_id,\n      latitude: msg.location.latitude,\n      longitude: msg.location.longitude,\n      actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },\n      source: 'telegram'\n    });\n    if (!result.ok) {\n      await reply(`❌ Gagal absen masuk: ${escapeHtml(result.error.message)}`);\n      return ok({ ok: true, error: result.error });\n    }\n    if (result.already) {\n      await reply('ℹ️ Sudah absen masuk hari ini sebelumnya. Kirim /pulang untuk absen pulang.');\n      return ok({ ok: true, already: true });\n    }\n    const r = result.row;\n    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'di luar radius outlet';\n    await reply(\n      `✅ Absen masuk tercatat.\\n\\nJam: ${escapeHtml(r.actual_check_in)}\\nStatus: ${escapeHtml(r.attendance_status)}\\nLokasi: ${locLabel}`\n    );\n    return ok({ ok: true, attendance_id: r.attendance_id });\n  }\n\n  const intent = parseAbsenIntent(msg.text);"
    ),
    # 2. clock-in handler — require location first
    (
        "  if (intent === 'clock-in') {\n    const loc = msg.location;\n    const result = await performClockIn({\n      employeeId: employee.employee_id,\n      latitude: loc?.latitude,\n      longitude: loc?.longitude,\n      actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },\n      source: 'telegram'\n    });",
        "  if (intent === 'clock-in') {\n    const loc = msg.location;\n    if (!loc) {\n      await reply('Kirim lokasi kamu untuk absen masuk. Tekan tombol \"Kirim Lokasi\" di bawah, atau kirim lokasi dari 📎 → Location.', locationReplyMarkup());\n      return ok({ ok: true });\n    }\n    const result = await performClockIn({\n      employeeId: employee.employee_id,\n      latitude: loc.latitude,\n      longitude: loc.longitude,\n      actor: { userId: actorUserId, role: actorRole, employeeId: employee.employee_id },\n      source: 'telegram'\n    });"
    ),
    # 3. fix locLabel in the (now rare) /masuk+location path
    (
        "    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'tanpa lokasi';",
        "    const locLabel = r.check_in_location === 'INSIDE_RADIUS' ? 'di dalam radius outlet' : 'di luar radius outlet';"
    ),
])

# 4. telegram-attendance.ts — update HELP_TEXT
ok2 = apply(f"{BASE}/src/lib/telegram-attendance.ts", [
    (
        "export const HELP_TEXT = [\n  'YKP HR Absen Bot',\n  '',\n  '/masuk — absen masuk (kirim lokasi atau langsung /masuk)',\n  '/pulang — absen pulang',\n  '/help — bantuan',\n  '',\n  'Untuk deteksi lokasi: kirim lokasi Telegram, atau /masuk lalu tekan tombol \"Kirim Lokasi\".'\n].join('\\n');",
        "export const HELP_TEXT = [\n  'YKP HR Absen Bot',\n  '',\n  '/masuk — absen masuk (bot akan minta lokasi)',\n  '/pulang — absen pulang',\n  '/help — bantuan',\n  '',\n  'Cara absen masuk: kirim lokasi kamu (tombol \"Kirim Lokasi\" atau 📎 → Location), atau /masuk lalu kirim lokasi.'\n].join('\\n');"
    ),
])

print("ALL:", ok1 and ok2)
