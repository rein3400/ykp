. "$PSScriptRoot\wb.ps1"

function Get-Report($outDir, $moduleId) {
    $resultsDir = Join-Path $outDir "results"
    $path = Join-Path $resultsDir "$moduleId-report.json"
    if (Test-Path $path) {
        $report = Get-Content $path | ConvertFrom-Json
        if (-not $report.PSObject.Properties['base']) {
            $report | Add-Member -MemberType NoteProperty -Name base -Value $null
        }
        return $report
    }
    return [PSCustomObject]@{
        module = $moduleId
        base = $null
        startedAt = (Get-Date).ToString("o")
        finishedAt = $null
        totals = [PSCustomObject]@{ actions = 0; pass = 0; fail = 0; skip = 0; error = 0 }
        login = $null
        actions = @()
        findings = @()
    }
}

function Save-Report($outDir, $moduleId, $report) {
    $dir = Join-Path $outDir "results"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $report.finishedAt = (Get-Date).ToString("o")
    $report.totals = [PSCustomObject]@{
        actions = $report.actions.Count
        pass = ($report.actions | Where-Object { $_.status -eq 'pass' }).Count
        fail = ($report.actions | Where-Object { $_.status -eq 'fail' }).Count
        skip = ($report.actions | Where-Object { $_.status -eq 'skip' }).Count
        error = ($report.actions | Where-Object { $_.status -eq 'error' }).Count
    }
    $path = Join-Path $dir "$moduleId-report.json"
    $report | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
}

function Add-Finding($report, $severity, $actionId, $msg, $evidence = $null) {
    $finding = [PSCustomObject]@{
        severity = $severity
        actionId = $actionId
        msg = $msg
        evidence = $evidence
        ts = (Get-Date).ToString("o")
    }
    $report.findings += $finding
}

function Write-Summary($outDir, $reports) {
    $summary = [PSCustomObject]@{
        ts = (Get-Date).ToString("o")
        modules = $reports | ForEach-Object {
            [PSCustomObject]@{
                module = $_.module
                totals = $_.totals
                loginOk = $_.login.ok
                findingsCount = $_.findings.Count
                critical = ($_.findings | Where-Object { $_.severity -eq 'CRITICAL' }).Count
                high = ($_.findings | Where-Object { $_.severity -eq 'HIGH' }).Count
            }
        }
        overall = [PSCustomObject]@{
            actions = ($reports | ForEach-Object { $_.totals.actions } | Measure-Object -Sum).Sum
            pass = ($reports | ForEach-Object { $_.totals.pass } | Measure-Object -Sum).Sum
            fail = ($reports | ForEach-Object { $_.totals.fail } | Measure-Object -Sum).Sum
            skip = ($reports | ForEach-Object { $_.totals.skip } | Measure-Object -Sum).Sum
            error = ($reports | ForEach-Object { $_.totals.error } | Measure-Object -Sum).Sum
            critical = ($reports | ForEach-Object { ($_.findings | Where-Object { $_.severity -eq 'CRITICAL' }).Count } | Measure-Object -Sum).Sum
            high = ($reports | ForEach-Object { ($_.findings | Where-Object { $_.severity -eq 'HIGH' }).Count } | Measure-Object -Sum).Sum
        }
    }
    $path = Join-Path $outDir "results" "summary.json"
    $summary | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
    return $summary
}
