. "$PSScriptRoot\lib\wb.ps1"

$script:WbSession = 'ykp-qa-test'

$navArgs = @{
    url = "https://example.com"
    newTab = $false
}

# Method 1: manual body (works)
$body1 = '{"args":{"url":"https://example.com","newTab":false},"session":"ykp-qa-test","action":"navigate"}'
Write-Host "Body1 length: $($body1.Length)"
$res1 = wb $body1
Write-Host "Res1: $res1"

# Method 2: ConvertTo-Json (fails)
$bodyObj = @{
    action = "navigate"
    args = $navArgs
    session = $script:WbSession
}
$body2 = $bodyObj | ConvertTo-Json -Depth 10 -Compress
Write-Host "Body2 length: $($body2.Length)"
$res2 = wb $body2
Write-Host "Res2: $res2"

# Compare bytes
$bytes1 = [System.Text.Encoding]::UTF8.GetBytes($body1)
$bytes2 = [System.Text.Encoding]::UTF8.GetBytes($body2)
Write-Host "Bytes equal: $($bytes1.Length -eq $bytes2.Length -and [System.Linq.Enumerable]::SequenceEqual($bytes1, $bytes2))"

Write-Host "Body1: $body1"
Write-Host "Body2: $body2"
