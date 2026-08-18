. "$PSScriptRoot\lib\wb.ps1"

$script:WbSession = 'ykp-qa-test'

# Reproduce nav internals
$url = "https://example.com"
$newTab = $false
$groupTitle = $null

$navArgs = @{
    url = $url
    newTab = $newTab
}
if ($groupTitle) { $navArgs.group_title = $groupTitle }

$bodyObj = @{
    action = "navigate"
    args = $navArgs
    session = $script:WbSession
}
$body = $bodyObj | ConvertTo-Json -Depth 10 -Compress
Write-Host "JSON: $body"

$res = wb $body
Write-Host "Response: $res"
