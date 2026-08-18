$ErrorActionPreference = "Continue"
$base = "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\tests\webbridge-hr-pg"
function tmp($body) {
  $f = Join-Path $base ("tmp-" + [System.IO.Path]::GetRandomFileName().Replace(".","-") + ".json")
  [System.IO.File]::WriteAllText($f, $body, [System.Text.UTF8Encoding]::new($false))
  return $f
}
function wb($body) {
  $f = tmp $body
  $r = curl.exe -s --max-time 20 -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" --data-binary "@$f"
  Remove-Item $f -Force -ErrorAction SilentlyContinue
  return $r
}
function snap($name) {
  $s = wb '{"action":"snapshot","args":{},"session":"hr-pg-qa"}'
  $s | Out-File -Encoding utf8 "$base\snap-$name.json"
  return $s
}
function shot($name) {
  $b = '{"action":"screenshot","args":{"path":"D:\\\\Users\\\\stefa\\\\Project\\\\YKP HERMEZ AI COMMAND CENTER\\\\tests\\\\webbridge-hr-pg\\\\' + $name + '.png"},"session":"hr-pg-qa"}'
  $r = wb $b
  $r | Out-File -Encoding utf8 "$base\shot-$name.json"
}
function click($ref, $name) {
  $r = wb ('{"action":"click","args":{"selector":"' + $ref + '"},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\click-$name.json"
  Start-Sleep -Milliseconds 1500
  snap "after-$name" | Out-Null
  shot "after-$name"
}
function nav($url, $name) {
  $r = wb ('{"action":"navigate","args":{"url":"' + $url + '","newTab":false},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\nav-$name.json"
  Start-Sleep -Milliseconds 1500
  snap $name | Out-Null
  shot $name
}
function fill($ref, $val, $name) {
  $b = '{"action":"fill","args":{"selector":"' + $ref + '","value":"' + $val + '"},"session":"hr-pg-qa"}'
  $r = wb $b
  $r | Out-File -Encoding utf8 "$base\fill-$name.json"
  Start-Sleep -Milliseconds 1000
  snap "after-fill-$name" | Out-Null
  shot "after-fill-$name"
}

# Rules: open + Tambah Rule again with fresh snap
nav "https://ykp-erp-hr-production.up.railway.app/rules" "rules5"
click "@e7" "rules-tambah5"

# Rules Edit first row
nav "https://ykp-erp-hr-production.up.railway.app/rules" "rules5b"
click "@e9" "rules-edit5"

# Employees: search via fill @e9
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp5"
fill "@e9" "Putri" "emp-search5"

# Employees: pagination Berikutnya
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp5b"
click "@e27" "emp-next5"

# Employees: Nonaktifkan first row (triggers window.confirm - may block or cancel)
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp5c"
# Install confirm override first
$ov = '{"action":"evaluate","args":{"code":"window.__confirmCalls=[]; window.confirm=function(m){window.__confirmCalls.push(m); return false;}"},"session":"hr-pg-qa"}'
wb $ov | Out-File -Encoding utf8 "$base\eval-confirm-override.json"
click "@e10" "emp-nonaktif5"
$chk = '{"action":"evaluate","args":{"code":"JSON.stringify(window.__confirmCalls||[])"},"session":"hr-pg-qa"}'
wb $chk | Out-File -Encoding utf8 "$base\eval-confirm-result.json"

# Summary: fill date + rebuild wait
nav "https://ykp-erp-hr-production.up.railway.app/summary" "sum5"
click "@e11" "sum-rebuild5"
Start-Sleep -Seconds 3
snap "sum-rebuild-done" | Out-Null
shot "sum-rebuild-done"

# Attendance empty links already tested
# Final home redirect check
nav "https://ykp-erp-hr-production.up.railway.app/" "final-home"

"done" | Out-File -Encoding utf8 "$base\phase5-done.txt"
