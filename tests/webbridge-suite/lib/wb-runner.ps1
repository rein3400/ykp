. "$PSScriptRoot\wb.ps1"
. "$PSScriptRoot\wb-dom.ps1"
. "$PSScriptRoot\wb-assert.ps1"
. "$PSScriptRoot\wb-auth.ps1"
. "$PSScriptRoot\wb-report.ps1"
. "$PSScriptRoot\wb-steps.ps1"

function Run-Actions($app, $actions, $outDir, $flags) {
    $script:WbSession = $app.session
    $script:CurrentReport = $null
    Ensure-WbDaemon

    $report = Get-Report $outDir $app.id
    $report.base = $app.base
    $script:CurrentReport = $report

    # Login
    $loginStart = Get-Date
    try {
        Ensure-Session $app
        $report.login = [PSCustomObject]@{ ok = $true; mode = $app.auth; ms = ([DateTime]::Now - $loginStart).TotalMilliseconds }
    } catch {
        $report.login = [PSCustomObject]@{ ok = $false; mode = $app.auth; ms = ([DateTime]::Now - $loginStart).TotalMilliseconds; error = $_.Exception.Message }
        Add-Finding $report 'CRITICAL' 'login' "Login failed: $($_.Exception.Message)"
        Save-Report $outDir $app.id $report
        return $report
    }

    foreach ($action in $actions) {
        # Skip logic
        $skipReason = $null
        if ($action.skip) { $skipReason = 'marked skip' }
        elseif ($action.destructive -and -not $flags.includeDestructive) { $skipReason = 'destructive (requires --include-destructive)' }
        elseif ($flags.only -and $action.id -notin $flags.only) { $skipReason = 'not in --only list' }
        elseif ($flags.from) {
            $fromIdx = [array]::FindIndex($actions, { param($a) $a.id -eq $flags.from })
            $curIdx = [array]::IndexOf($actions, $action)
            if ($curIdx -lt $fromIdx) { $skipReason = 'before --from' }
        }
        if (-not $skipReason) {
            $existing = $report.actions | Where-Object { $_.id -eq $action.id } | Select-Object -First 1
            if ($existing -and $existing.status -eq 'pass' -and -not $flags.rerunPassed) {
                $skipReason = 'already passed (resume)'
            }
        }

        if ($skipReason) {
            $entry = [PSCustomObject]@{ id = $action.id; title = $action.title; status = 'skip'; reason = $skipReason }
            Upsert-Action $report $entry
            Save-Report $outDir $app.id $report
            continue
        }

        $result = Run-Action $app $action $outDir $flags
        Upsert-Action $report $result
        Save-Report $outDir $app.id $report
    }

    Save-Report $outDir $app.id $report
    return $report
}

function Upsert-Action($report, $entry) {
    $idx = -1
    for ($i = 0; $i -lt $report.actions.Count; $i++) {
        if ($report.actions[$i].id -eq $entry.id) { $idx = $i; break }
    }
    if ($idx -ge 0) { $report.actions[$idx] = $entry }
    else { $report.actions += $entry }
}

function Run-Action($app, $action, $outDir, $flags) {
    $t0 = Get-Date
    $actionId = $action.id
    $screenshotDir = Join-Path $outDir "screenshots" $app.id $actionId
    New-Item -ItemType Directory -Force -Path $screenshotDir | Out-Null

    $ctx = @{
        app = $app
        base = $app.base
        vars = @{ ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds() }
        screenshotDir = $screenshotDir
        networkLog = @()
        consoleLog = @()
    }

    $result = [PSCustomObject]@{
        id = $actionId
        title = $action.title
        module = if ($action.module) { $action.module } else { $app.id }
        status = 'error'
        startedAt = $t0.ToString("o")
        durationMs = 0
        stepResults = @()
        verifyResults = @()
        consoleErrors = @()
        networkFails = @()
        screenshots = @()
        attempts = 1
        error = $null
    }

    try {
        Ensure-Session $app

        # Seed
        foreach ($seed in $action.seed) {
            $r = Invoke-Step $seed $ctx
            $result.stepResults += [PSCustomObject]($r + @{ phase = 'seed' })
            if (-not $r.ok) { throw "Seed failed: $($r.reason)" }
        }

        # Steps
        foreach ($step in $action.steps) {
            $r = Invoke-Step $step $ctx
            $result.stepResults += [PSCustomObject]($r + @{ phase = 'steps' })
            if ($r.path) { $result.screenshots += $r.path }
            if (-not $r.ok) {
                $failShot = Join-Path $screenshotDir "step-fail.png"
                try { shot "step-fail" $failShot | Out-Null; $result.screenshots += $failShot } catch {}
                $result.status = 'fail'
                $result.error = $r.reason
                break
            }
        }

        # Verify
        if ($result.status -ne 'fail') {
            $allOk = $true
            foreach ($verify in $action.verify) {
                $r = Invoke-Verify $verify $ctx
                $result.verifyResults += [PSCustomObject]$r
                if (-not $r.ok) { $allOk = $false }
            }
            $result.status = if ($allOk) { 'pass' } else { 'fail' }
            if (-not $allOk) {
                $failShot = Join-Path $screenshotDir "verify-fail.png"
                try { shot "verify-fail" $failShot | Out-Null; $result.screenshots += $failShot } catch {}
            }
        }

        # Cleanup
        foreach ($cleanup in $action.cleanup) {
            if ($cleanup.optional -and $result.status -ne 'pass') { continue }
            $r = Invoke-Step $cleanup $ctx
            $result.stepResults += [PSCustomObject]($r + @{ phase = 'cleanup' })
        }
    } catch {
        $result.status = 'error'
        $result.error = $_.Exception.Message
        $failShot = Join-Path $screenshotDir "exception.png"
        try { shot "exception" $failShot | Out-Null; $result.screenshots += $failShot } catch {}
    }

    $result.durationMs = ([DateTime]::Now - $t0).TotalMilliseconds
    $result.consoleErrors = $ctx.consoleLog | Where-Object { $_.level -eq 'error' } | Select-Object -First 20
    $result.networkFails = $ctx.networkLog | Where-Object { $_.status -ge 400 } | Select-Object -First 20

    # Retry once on error
    if ($result.status -eq 'error' -and -not $flags.noRetry) {
        $result.attempts = 2
        $retry = Run-Action $app $action $outDir ($flags + @{ noRetry = $true })
        $retry.attempts = 2
        return $retry
    }

    # Findings
    if ($result.status -eq 'fail') {
        $errMsg = if ($result.error) { $result.error } else { 'verify failed' }
        Add-Finding $script:CurrentReport 'HIGH' $actionId "Action failed: $errMsg"
    }
    if (($result.networkFails | Where-Object { $_.status -ge 500 }).Count -gt 0) {
        Add-Finding $script:CurrentReport 'CRITICAL' $actionId "Action caused 5xx network failure" ($result.networkFails | Where-Object { $_.status -ge 500 })
    }
    if ($result.consoleErrors.Count -gt 0) {
        Add-Finding $script:CurrentReport 'MEDIUM' $actionId "Console errors detected" $result.consoleErrors
    }
    if ($result.durationMs -gt 10000) {
        Add-Finding $script:CurrentReport 'LOW' $actionId "Slow action: $($result.durationMs)ms"
    }

    return $result
}
