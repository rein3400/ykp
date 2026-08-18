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
function nav($url, $name) {
  $r = wb ('{"action":"navigate","args":{"url":"' + $url + '","newTab":false},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\nav-$name.json"
  Start-Sleep -Seconds 1
  $s = wb '{"action":"snapshot","args":{},"session":"hr-pg-qa"}'
  $s | Out-File -Encoding utf8 "$base\snap-$name.json"
  $s
}
function shot($name) {
  $path = $name -replace '\W','-'
  $b = '{"action":"screenshot","args":{"path":"D:\\\\Users\\\\stefa\\\\Project\\\\YKP HERMEZ AI COMMAND CENTER\\\\tests\\\\webbridge-hr-pg\\\\' + $path + '.png"},"session":"hr-pg-qa"}'
  $r = wb $b
  $r | Out-File -Encoding utf8 "$base\shot-$name.json"
}
function click($ref, $name) {
  $r = wb ('{"action":"click","args":{"selector":"' + $ref + '"},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\click-$name.json"
  Start-Sleep -Seconds 1
  $s = wb '{"action":"snapshot","args":{},"session":"hr-pg-qa"}'
  $s | Out-File -Encoding utf8 "$base\snap-after-$name.json"
  shot "after-$name"
  $s
}
function eval($code, $name) {
  $b = '{"action":"evaluate","args":{"code":"' + ($code -replace '"','\\"') + '"},"session":"hr-pg-qa"}'
  $r = wb $b
  $r | Out-File -Encoding utf8 "$base\eval-$name.json"
  $r
}

nav "https://ykp-erp-hr-production.up.railway.app/" "home"
shot "home"
nav "https://ykp-erp-hr-production.up.railway.app/attendance" "attendance"
shot "attendance"
nav "https://ykp-erp-hr-production.up.railway.app/payroll" "payroll"
shot "payroll"
nav "https://ykp-erp-hr-production.up.railway.app/rules" "rules"
shot "rules"
nav "https://ykp-erp-hr-production.up.railway.app/employees" "employees"
shot "employees"
nav "https://ykp-erp-hr-production.up.railway.app/summary" "summary"
shot "summary"

"done" | Out-File -Encoding utf8 "$base\phase1-done.txt"
