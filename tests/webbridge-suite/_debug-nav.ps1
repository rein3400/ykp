. "$PSScriptRoot\lib\wb.ps1"

$script:WbSession = 'ykp-qa-test'
$myArgs = @{ url = 'https://example.com'; newTab = $false }
$res = wbjson "navigate" $myArgs $script:WbSession
Write-Host ($res | ConvertTo-Json -Depth 5)
