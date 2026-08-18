. "$PSScriptRoot\..\lib\config.psd1"
. "$PSScriptRoot\..\lib\wb.ps1"
. "$PSScriptRoot\..\lib\wb-dom.ps1"
. "$PSScriptRoot\..\lib\wb-assert.ps1"
. "$PSScriptRoot\..\lib\wb-auth.ps1"
. "$PSScriptRoot\..\lib\wb-report.ps1"
. "$PSScriptRoot\..\lib\wb-steps.ps1"
. "$PSScriptRoot\..\lib\wb-runner.ps1"

$config = Import-PowerShellDataFile "$PSScriptRoot\..\lib\config.psd1"
$app = $config.warehouse
$actions = Get-Content "$PSScriptRoot\..\actions\warehouse.actions.json" | ConvertFrom-Json

$flags = @{
    headed = $args -contains '--headed'
    includeDestructive = $args -contains '--include-destructive'
    noRetry = $args -contains '--no-retry'
    only = ($args | Where-Object { $_ -like '--only=*' }) -replace '--only=', '' -split ','
    from = ($args | Where-Object { $_ -like '--from=*' }) -replace '--from=', ''
    rerunPassed = $args -contains '--rerun-passed'
}

$outDir = Join-Path $PSScriptRoot ".."
$report = Run-Actions $app $actions $outDir $flags

if ($report.totals.fail + $report.totals.error -gt 0) { exit 1 }
exit 0
