. "$PSScriptRoot\lib\wb.ps1"
. "$PSScriptRoot\lib\wb-dom.ps1"

$script:WbSession = 'ykp-qa-test'

# Navigate to investor login
nav "https://ykp-investor-v1.vercel.app/login" "login" $false "QA Test"
waitSettled 2000

# Snapshot to see what inputs exist
$snap = snap "login-page"
Write-Host "URL: $($snap.url)"
Write-Host "Title: $($snap.title)"

# Try fill with CSS selector
try {
    fillRef "input[name='username']" "owner"
    Write-Host "Fill username OK"
} catch {
    Write-Host "Fill username failed: $_"
}

try {
    fillRef "input[type='text']" "owner"
    Write-Host "Fill text OK"
} catch {
    Write-Host "Fill text failed: $_"
}
