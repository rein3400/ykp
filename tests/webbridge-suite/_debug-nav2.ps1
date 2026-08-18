. "$PSScriptRoot\lib\wb.ps1"

$script:WbSession = 'ykp-qa-test'

# Try 1: current format
$body1 = @{
    action = 'navigate'
    args = @{ url = 'https://example.com'; newTab = $false }
    session = $script:WbSession
} | ConvertTo-Json -Depth 10 -Compress
Write-Host "Body1: $body1"
$res1 = wb $body1
Write-Host "Res1: $res1"

# Try 2: url top-level
$body2 = @{
    action = 'navigate'
    args = @{ url = 'https://example.com' }
    session = $script:WbSession
} | ConvertTo-Json -Depth 10 -Compress
Write-Host "Body2: $body2"
$res2 = wb $body2
Write-Host "Res2: $res2"

# Try 3: flatten
$body3 = @{
    action = 'navigate'
    url = 'https://example.com'
    session = $script:WbSession
} | ConvertTo-Json -Depth 10 -Compress
Write-Host "Body3: $body3"
$res3 = wb $body3
Write-Host "Res3: $res3"
