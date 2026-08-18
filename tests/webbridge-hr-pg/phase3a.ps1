$ErrorActionPreference = "Continue"
$base = "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\tests\webbridge-hr-pg"
function tmp($body) {
  $f = Join-Path $base ("tmp-" + [System.IO.Path]::GetRandomFileName().Replace(".","-") + ".json")
  [System.IO.File]::WriteAllText($f, $body, [System.Text.UTF8Encoding]::new($false))
  return $f
}
function wb($body) {
  $f = tmp $body
  try {
    $r = curl.exe -s --max-time 30 -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" --data-binary "@$f"
  } catch {
    $r = "{`"error`":`"$_`"}"
  }
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
  return $r
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
  Start-Sleep -Milliseconds 800
  snap "after-fill-$name" | Out-Null
}
function wbeval($code, $name) {
  $obj = @{ action = "evaluate"; args = @{ code = $code }; session = "hr-pg-qa" }
  $json = $obj | ConvertTo-Json -Compress -Depth 10
  $r = wb $json
  $r | Out-File -Encoding utf8 "$base\eval-$name.json"
  return $r
}

Write-Host "=== EMP INTERACT ==="
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-i1"
$s = snap "emp-i1b"
# Parse refs for Import CSV / + Karyawan
$tree = Get-Content "$base\snap-emp-i1b.json" -Raw
$tree | Out-File -Encoding utf8 "$base\emp-i1b-raw.txt"
# Use evaluate to click by text
Write-Host "click Import CSV"
wbeval "(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>(x.textContent||'').trim()==='Import CSV'); if(!a) return 'no-import'; a.click(); return a.tagName+':'+a.textContent;})()" "emp-import-csv" | Out-Null
Start-Sleep -Milliseconds 1500
snap "after-emp-import-csv" | Out-Null
shot "after-emp-import-csv"

Write-Host "nav back employees"
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-i2"
Write-Host "click + Karyawan"
wbeval "(()=>{const a=[...document.querySelectorAll('a,button')].find(x=>(x.textContent||'').includes('+ Karyawan')||(x.textContent||'').includes('Karyawan')&&(x.textContent||'').includes('+')); if(!a) return 'no-add'; a.click(); return a.tagName+':'+a.textContent;})()" "emp-add" | Out-Null
Start-Sleep -Milliseconds 1500
snap "after-emp-add" | Out-Null
shot "after-emp-add"

Write-Host "done phase3a"
"done" | Out-File -Encoding utf8 "$base\phase3a-done.txt"
