. "$PSScriptRoot\lib\config.psd1"
. "$PSScriptRoot\lib\wb.ps1"
. "$PSScriptRoot\lib\wb-report.ps1"

$moduleOrder = @('investor', 'hubOps', 'hrProd', 'finance', 'hermez', 'hrPilot', 'warehouse')

$onlyModules = ($args | Where-Object { $_ -like '--module=*' }) -replace '--module=', '' -split ','
$parallel = [int](($args | Where-Object { $_ -like '--parallel=*' }) -replace '--parallel=', '1')
$headed = $args -contains '--headed'
$includeDestructive = $args -contains '--include-destructive'

$modules = if ($onlyModules) { $moduleOrder | Where-Object { $onlyModules -contains $_ } } else { $moduleOrder }

Write-Host "Running modules: $($modules -join ', ') (parallel=$parallel)"

$results = @()

foreach ($m in $modules) {
    $script = Join-Path $PSScriptRoot "modules" "run-$m.ps1"
    if (-not (Test-Path $script)) {
        Write-Warning "Runner not found: $script"
        continue
    }
    $procArgs = @()
    if ($headed) { $procArgs += '--headed' }
    if ($includeDestructive) { $procArgs += '--include-destructive' }
    Write-Host "Starting $m..."
    $p = Start-Process pwsh -ArgumentList "-NoProfile -File `"$script`" $($procArgs -join ' ')" -Wait -PassThru -NoNewWindow
    $results += @{ module = $m; code = $p.ExitCode }
}

$reports = @()
foreach ($m in $modules) {
    $config = Import-PowerShellDataFile "$PSScriptRoot\lib\config.psd1"
    $app = $config.$m
    $reports += Get-Report (Join-Path $PSScriptRoot "") $app.id
}

$summary = Write-Summary (Join-Path $PSScriptRoot "") $reports

$failed = $results | Where-Object { $_.code -ne 0 }
Write-Host "`nDone. $($results.Count - $failed.Count)/$($results.Count) modules OK."
if ($failed) {
    Write-Host "Failed modules: $($failed.module -join ', ')"
    exit 1
}
exit 0
