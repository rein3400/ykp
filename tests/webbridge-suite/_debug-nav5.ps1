. "$PSScriptRoot\lib\wb.ps1"

$script:WbSession = 'ykp-qa-test'

$navArgs = @{
    url = "https://example.com"
    newTab = $false
}

# What wbjson does
$bodyObj = @{
    action = "navigate"
    args = $navArgs
    session = $script:WbSession
}
$body = $bodyObj | ConvertTo-Json -Depth 10 -Compress
Write-Host "wbjson body: $body"

# Call wbjson
$res = wbjson "navigate" $navArgs $script:WbSession
Write-Host "wbjson result: $($res | ConvertTo-Json -Depth 5)"
