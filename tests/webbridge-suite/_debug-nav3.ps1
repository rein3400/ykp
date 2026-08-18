. "$PSScriptRoot\lib\wb.ps1"
. "$PSScriptRoot\lib\wb-dom.ps1"

$script:WbSession = 'ykp-qa-test'

try {
    $res = nav "https://example.com" "test" $false $null
    Write-Host "Success: $($res | ConvertTo-Json -Depth 5)"
} catch {
    Write-Host "Error: $_"
}
