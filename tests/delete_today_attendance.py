import paramiko

HOST = "187.77.114.168"
USER = "dev"
PWD = "password"

cmd = (
    "cd /home/dev/ykp/ykp-hr-v1 && export PATH=/home/dev/.nvm/versions/node/v20.20.2/bin:/usr/bin:/bin && "
    "set -a && . ./.env && set +a && "
    "npx tsx -e \""
    "import { readTab, TABS, getSheetsClient, getSpreadsheetId } from './src/db/sheets';"
    "import { todayWib } from './src/lib/format';"
    "(async () => {"
    "  const today = todayWib();"
    "  const sheets = getSheetsClient();"
    "  const sid = getSpreadsheetId();"
    "  const meta = await sheets.spreadsheets.get({ spreadsheetId: sid });"
    "  const tab = meta.data.sheets?.find(s => s.properties?.title === TABS.attendance);"
    "  const sheetId = tab?.properties?.sheetId;"
    "  console.log('ATTENDANCE_SHEET_ID', sheetId);"
    "  const rows = await readTab(TABS.attendance);"
    "  const targets = rows.filter(a => a.date === today && a.employee_id === 'EMP-001');"
    "  console.log('TODAY', today);"
    "  console.log('TARGETS', JSON.stringify(targets));"
    "  if (targets.length === 0) { console.log('NO_ROWS'); return; }"
    "  const ids = new Set(targets.map(t => t.attendance_id));"
    "  const rowNumbers = [];"
    "  for (let i = 0; i < rows.length; i++) {"
    "    if (ids.has(rows[i].attendance_id)) rowNumbers.push(i + 2);"
    "  }"
    "  console.log('ROW_NUMBERS', JSON.stringify(rowNumbers));"
    "  rowNumbers.sort((a,b) => b - a);"
    "  for (const rn of rowNumbers) {"
    "    await sheets.spreadsheets.batchUpdate({"
    "      spreadsheetId: sid,"
    "      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rn - 1, endIndex: rn } } }] }"
    "    });"
    "    console.log('DELETED_ROW', rn);"
    "  }"
    "})();\""
)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username=USER, password=PWD, timeout=30)
stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
out = stdout.read().decode()
err = stderr.read().decode()
print("STDOUT:", out)
print("STDERR:", err)
c.close()
