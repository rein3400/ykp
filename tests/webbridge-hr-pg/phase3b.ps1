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
function nav($url, $name) {
  $r = wb ('{"action":"navigate","args":{"url":"' + $url + '","newTab":false},"session":"hr-pg-qa"}')
  $r | Out-File -Encoding utf8 "$base\nav-$name.json"
  Start-Sleep -Milliseconds 1200
  snap $name | Out-Null
  shot $name
}
function wbeval($code, $name) {
  $obj = @{ action = "evaluate"; args = @{ code = $code }; session = "hr-pg-qa" }
  $json = $obj | ConvertTo-Json -Compress -Depth 10
  $r = wb $json
  $r | Out-File -Encoding utf8 "$base\eval-$name.json"
  return $r
}

# Close any open modal first
Write-Host "close modal"
wbeval "(()=>{const b=document.querySelector('[aria-label=Close],button[aria-label=Close]'); if(b){b.click();return 'closed-btn';} const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); document.dispatchEvent(esc); return 'esc';})()" "close-modal" | Out-Null
Start-Sleep -Milliseconds 800

# Search Putri
Write-Host "search"
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-search3"
wbeval "(()=>{const i=document.querySelector('input[placeholder*=\"Cari\"],input[type=search],input[placeholder*=\"karyawan\"]'); if(!i) return 'no-input'; i.focus(); i.value='Putri'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); return i.placeholder||i.name||'ok';})()" "emp-search-putri" | Out-Null
Start-Sleep -Milliseconds 1500
snap "after-emp-search-putri3" | Out-Null
shot "after-emp-search-putri3"

# Pagination Next
Write-Host "pagination"
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-page3"
wbeval "(()=>{const b=[...document.querySelectorAll('button')].find(x=> (x.getAttribute('aria-label')||'').toLowerCase().includes('next') || (x.textContent||'').includes('Berikutnya')); if(!b) return 'no-next'; b.click(); return b.getAttribute('aria-label')||b.textContent;})()" "page-next3" | Out-Null
Start-Sleep -Milliseconds 1500
snap "after-emp-page-next3" | Out-Null
shot "after-emp-page-next3"

# Nonaktifkan - click first only, do not confirm permanently if possible
Write-Host "nonaktif"
nav "https://ykp-erp-hr-production.up.railway.app/employees" "emp-non3"
wbeval "(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('Nonaktifkan')); if(!b) return 'no-btn'; b.click(); return b.textContent;})()" "nonaktif3" | Out-Null
Start-Sleep -Milliseconds 1500
snap "after-emp-nonaktif3" | Out-Null
shot "after-emp-nonaktif3"

Write-Host "done phase3b"
"done" | Out-File -Encoding utf8 "$base\phase3b-done.txt"
