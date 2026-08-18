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
  Start-Sleep -Milliseconds 2000
  snap $name | Out-Null
  shot $name
}

Start-Sleep -Seconds 10

# Nonaktifkan with confirm override
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp6"
$ov = '{"action":"evaluate","args":{"code":"window.__confirmCalls=[]; window.confirm=function(m){window.__confirmCalls.push(String(m)); return false;}"},"session":"hr-pg-qa"}'
wb $ov | Out-File -Encoding utf8 "$base\eval-confirm-override6.json"
# Get fresh refs
snap "emp6b" | Out-Null
# Click Nonaktifkan @e10 from emp-base2
click "@e10" "emp-nonaktif6"
$chk = '{"action":"evaluate","args":{"code":"JSON.stringify(window.__confirmCalls||[])"},"session":"hr-pg-qa"}'
wb $chk | Out-File -Encoding utf8 "$base\eval-confirm-result6.json"

# Pagination next - verify page number changed
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp6c"
snap "emp6c-before" | Out-Null
click "@e27" "emp-next6"
# Get page text
$pg = '{"action":"evaluate","args":{"code":"(()=>{const t=document.body.innerText; const m=t.match(/Hal\\.?\\s*(\\d+)\\s*\\/\\s*(\\d+)/); return m?m[0]:t.slice(0,200);})()"},"session":"hr-pg-qa"}'
wb $pg | Out-File -Encoding utf8 "$base\eval-page-after-next6.json"

# Summary rebuild wait finish
nav "https://ykp-erp-hr-production.up.railway.app/summary" "sum6"
click "@e11" "sum-rebuild6"
Start-Sleep -Seconds 5
snap "sum-rebuild-final" | Out-Null
shot "sum-rebuild-final"

# Attendance Refresh with correct path check
nav "https://ykp-erp-hr-production.up.railway.app/attendance" "att6"
# Evaluate hrefs of empty-state buttons
$hrefs = '{"action":"evaluate","args":{"code":"(()=>[...document.querySelectorAll(\"a\")].map(a=>({text:a.textContent.trim(),href:a.getAttribute(\"href\")})).filter(x=>x.text))()"},"session":"hr-pg-qa"}'
wb $hrefs | Out-File -Encoding utf8 "$base\eval-att-hrefs.json"

"done" | Out-File -Encoding utf8 "$base\phase6-done.txt"
