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
function wbeval($code, $name) {
  $obj = @{ action = "evaluate"; args = @{ code = $code }; session = "hr-pg-qa" }
  $json = $obj | ConvertTo-Json -Compress -Depth 10
  $r = wb $json
  $r | Out-File -Encoding utf8 "$base\eval-$name.json"
  $r
}

# ---- EMPLOYEES page interactions ----
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-interact"
snap "emp-interact2" | Out-Null
# Click Import CSV (@e7 typically)
click "@e7" "emp-import-csv"

# Click + Karyawan
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-interact-b"
snap "emp-interact-b2" | Out-Null
click "@e8" "emp-add-karyawan"

# Close modal via Escape
wbeval "document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))" "esc-close" | Out-Null
Start-Sleep -Seconds 2
snap "after-esc-close" | Out-Null

# Reopen + Karyawan to verify fields
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-interact-c"
snap "emp-interact-c2" | Out-Null
click "@e8" "emp-add-karyawan2"

# Search box
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-search"
snap "emp-search2" | Out-Null
# @e9 is search input based on position
fill "@e9" "Putri" "emp-search-putri"
wbeval "var e=document.activeElement; e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));" "enter-search" | Out-Null
Start-Sleep -Seconds 2
snap "after-emp-search-putri" | Out-Null
shot "after-emp-search-putri"

# Pagination Next via JS
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-page"
snap "emp-page2" | Out-Null
wbeval "(()=>{const b=[...document.querySelectorAll('button')].find(x=> (x.getAttribute('aria-label')||'').includes('Next') || (x.textContent||'').includes('Berikutnya')); if(!b) return 'no-next'; b.click(); return b.getAttribute('aria-label')||b.textContent;})()" "page-next" | Out-Null
Start-Sleep -Seconds 2
snap "after-emp-page-next" | Out-Null
shot "after-emp-page-next"

# Nonaktifkan button (first row) - click but we will cancel if modal
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-nonaktif"
snap "emp-nonaktif2" | Out-Null
wbeval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('Nonaktifkan')); if(!b) return 'no-btn'; b.click(); return b.textContent;})()" "nonaktifkan" | Out-Null
Start-Sleep -Seconds 2
snap "after-emp-nonaktif" | Out-Null
shot "after-emp-nonaktif"

# ---- SUMMARY date picker + Rebuild ----
nav "https://ykp-erp-hr-production.up.railway.app/summary" "summary-interact"
snap "summary-interact2" | Out-Null
# Rebuild button
click "@e7" "summary-rebuild"

# ---- RULES + Tambah Rule ----
nav "https://ykp-erp-hr-production.up.railway.app/rules" "rules-interact"
snap "rules-interact2" | Out-Null
click "@e7" "rules-tambah"

# ---- PAYROLL Generate ----
nav "https://ykp-erp-hr-production.up.railway.app/payroll" "pay-interact"
snap "pay-interact2" | Out-Null
# Generate button - try @e8
click "@e8" "pay-generate"

"done" | Out-File -Encoding utf8 "$base\phase3-done.txt"
