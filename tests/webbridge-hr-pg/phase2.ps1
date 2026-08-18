$base = "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\tests\webbridge-hr-pg"
function tmp($body) {
  $f = Join-Path $base ("tmp-" + [System.IO.Path]::GetRandomFileName().Replace(".","-") + ".json")
  [System.IO.File]::WriteAllText($f, $body, [System.Text.UTF8Encoding]::new($false))
  return $f
}
function wb($body) {
  $f = tmp $body
  $r = curl.exe -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" --data-binary "@$f"
  Remove-Item $f -Force
  return $r
}
function snap($name) {
  Start-Sleep -Seconds 1
  $s = wb '{"action":"snapshot","args":{},"session":"hr-pg-qa"}'
  $s | Out-File -Encoding utf8 "$base\snap-$name.json"
  $s
}
function shot($name) {
  $b = '{"action":"screenshot","args":{"path":"D:\\\\Users\\\\stefa\\\\Project\\\\YKP HERMEZ AI COMMAND CENTER\\\\tests\\\\webbridge-hr-pg\\\\' + $name + '.png"},"session":"hr-pg-qa"}'
  $r = wb $b
  $r | Out-File -Encoding utf8 "$base\shot-$name.json"
}
function click($ref, $name) {
  $r = wb ('{"action":"click","args":{"selector":"' + $ref + '"},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\click-$name.json"
  Start-Sleep -Seconds 2
  snap "after-$name" | Out-Null
  shot "after-$name"
}
function nav($url, $name) {
  $r = wb ('{"action":"navigate","args":{"url":"' + $url + '","newTab":false},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\nav-$name.json"
  Start-Sleep -Seconds 2
  snap $name | Out-Null
  shot $name
}
function fill($ref, $val, $name) {
  $b = '{"action":"fill","args":{"selector":"' + $ref + '","value":"' + $val + '"},"session":"hr-pg-qa"}'
  $r = wb $b
  $r | Out-File -Encoding utf8 "$base\fill-$name.json"
  Start-Sleep -Seconds 1
  snap "after-fill-$name" | Out-Null
}

# Wait for rate limit to cool
Start-Sleep -Seconds 8

# --- RINGKASAN click (sidebar) ---
nav "https://ykp-erp-hr-production.up.railway.app/attendance" "att-base"
# Get fresh snapshot refs
$s = snap "att-base2"
click "@e1" "ringkasan-sidebar"

# --- ABSENSI: Import CSV + Refresh ---
nav "https://ykp-erp-hr-production.up.railway.app/attendance" "att-buttons"
$s = snap "att-buttons2"
# Import CSV = @e7, Refresh = @e8 (from earlier)
click "@e7" "import-csv-att"
# Note after-action URL
nav "https://ykp-erp-hr-production.up.railway.app/attendance" "att-refresh"
$s = snap "att-refresh2"
click "@e8" "refresh-att"

# --- PAYROLL ---
nav "https://ykp-erp-hr-production.up.railway.app/payroll" "pay-base"
$s = snap "pay-base2"
# dump interactive refs for payroll
$j = Get-Content "$base\snap-pay-base2.json" -Raw
[System.IO.File]::WriteAllText("$base\payroll-tree.txt", $j)

# --- RULES ---
nav "https://ykp-erp-hr-production.up.railway.app/rules" "rules-base"
$s = snap "rules-base2"

# --- EMPLOYEES ---
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-base"
$s = snap "emp-base2"
$j = Get-Content "$base\snap-emp-base2.json" -Raw
[System.IO.File]::WriteAllText("$base\emp-tree.txt", $j)

# --- SUMMARY (retry) ---
Start-Sleep -Seconds 5
nav "https://ykp-erp-hr-production.up.railway.app/summary" "summary2"
$s = snap "summary2b"

"done" | Out-File -Encoding utf8 "$base\phase2-done.txt"
