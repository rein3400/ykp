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
  Start-Sleep -Milliseconds 1200
  snap $name | Out-Null
  shot $name
}

# Summary Rebuild
nav "https://ykp-erp-hr-production.up.railway.app/summary" "summary3"
click "@e11" "summary-rebuild3"

# Rules + Tambah Rule
nav "https://ykp-erp-hr-production.up.railway.app/rules" "rules3"
click "@e7" "rules-tambah3"

# Payroll Generate
nav "https://ykp-erp-hr-production.up.railway.app/payroll" "pay3"
click "@e7" "pay-generate3"

# Sidebar Ringkasan click
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-final"
click "@e1" "sidebar-ringkasan"

"done" | Out-File -Encoding utf8 "$base\phase4-done.txt"
