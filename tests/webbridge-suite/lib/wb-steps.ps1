. "$PSScriptRoot\wb.ps1"
. "$PSScriptRoot\wb-dom.ps1"
. "$PSScriptRoot\wb-assert.ps1"
. "$PSScriptRoot\wb-auth.ps1"

function tpl($str, $ctx) {
    if ($str -isnot [string]) { return $str }
    return [regex]::Replace($str, '\{\{(\w+)\}\}', {
        param($m)
        $key = $m.Groups[1].Value
        if ($ctx.vars.ContainsKey($key)) { return $ctx.vars[$key] }
        return $m.Value
    })
}

function Invoke-Step($step, $ctx) {
    $name = $step.do
    try {
        switch ($name) {
            'goto' {
                $base = $ctx.base.TrimEnd('/')
                $pathVal = tpl $step.path $ctx
                $url = if ($pathVal -match '^https?://') { $pathVal } else { $base + $pathVal }
                nav $url "goto" $false $null
                return @{ ok = $true; name = $name; target = $url }
            }
            'clickText' {
                $text = tpl $step.text $ctx
                clickText $text $step.role
                return @{ ok = $true; name = $name; target = $text }
            }
            'clickRef' {
                $ref = tpl $step.ref $ctx
                clickRef $ref
                return @{ ok = $true; name = $name; target = $ref }
            }
            'fillByLabel' {
                $label = tpl $step.label $ctx
                $value = tpl $step.value $ctx
                fillByLabel $label $value
                return @{ ok = $true; name = $name; label = $label }
            }
            'fillRef' {
                $ref = tpl $step.ref $ctx
                $value = tpl $step.value $ctx
                fillRef $ref $value
                return @{ ok = $true; name = $name; ref = $ref }
            }
            'expectDialog' {
                $ok = (Assert-DialogOpen).ok
                if (-not $ok) { throw "Dialog not open" }
                return @{ ok = $true; name = $name }
            }
            'closeDialog' {
                Close-Dialog | Out-Null
                return @{ ok = $true; name = $name }
            }
            'screenshot' {
                $shotName = tpl $step.name $ctx
                $dir = $ctx.screenshotDir
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
                $fname = ($shotName -replace '[^a-zA-Z0-9-]', '-').ToLower() + ".png"
                $fpath = Join-Path $dir $fname
                shot $shotName $fpath | Out-Null
                return @{ ok = $true; name = $name; path = $fpath }
            }
            'waitForText' {
                $text = tpl $step.text $ctx
                $timeout = if ($step.timeoutMs) { $step.timeoutMs } else { 10000 }
                waitForText $text $timeout
                return @{ ok = $true; name = $name }
            }
            'waitSettled' {
                $ms = if ($step.ms) { $step.ms } else { 1500 }
                waitSettled $ms
                return @{ ok = $true; name = $name }
            }
            'apiFetch' {
                $url = tpl $step.url $ctx
                $method = if ($step.method) { $step.method } else { 'GET' }
                $body = if ($step.body) { tpl ($step.body | ConvertTo-Json -Compress) $ctx } else { $null }
                $code = @"
(async () => {
  const opts = { method: '$method', credentials: 'include' };
  if ('$body' && '$body' !== '') {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = '$body';
  }
  const res = await fetch('$url', opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json: json };
})()
"@
                $res = wbeval $code
                if ($step.saveAs) { $ctx.vars[$step.saveAs] = $res.value.json }
                if ($step.pick -and $step.as) {
                    $parts = $step.pick -split '\.'
                    $val = $res.value.json
                    foreach ($p in $parts) { $val = $val.$p }
                    $ctx.vars[$step.as] = $val
                }
                return @{ ok = $res.value.ok; name = $name; status = $res.value.status }
            }
            'upload' {
                $selector = tpl $step.selector $ctx
                $filePath = tpl $step.path $ctx
                $abs = if ([System.IO.Path]::IsPathRooted($filePath)) { $filePath } else { Join-Path (Get-Location) $filePath }
                $res = wbjson "upload" @{ selector = $selector; files = @($abs) } $script:WbSession
                return @{ ok = $res.ok; name = $name; file = $abs }
            }
            'login' {
                Ensure-Session $ctx.app
                return @{ ok = $true; name = $name }
            }
            'logout' {
                Logout
                return @{ ok = $true; name = $name }
            }
            'sso' {
                Login-SSO $ctx.app
                return @{ ok = $true; name = $name }
            }
            'confirmOverride' {
                Confirm-Override $step.returnValue | Out-Null
                return @{ ok = $true; name = $name }
            }
            'confirmRead' {
                $calls = Confirm-Read
                $ctx.vars['confirmCalls'] = $calls
                return @{ ok = $true; name = $name; calls = $calls }
            }
            default {
                return @{ ok = $false; name = $name; reason = "unknown step type: $name" }
            }
        }
    } catch {
        return @{ ok = $false; name = $name; reason = $_.Exception.Message }
    }
}

function Invoke-Verify($verify, $ctx) {
    $type = $verify.type
    try {
        switch ($type) {
            'urlMatches' {
                $pattern = tpl $verify.pattern $ctx
                return Assert-UrlMatches $pattern
            }
            'textPresent' {
                $text = tpl $verify.text $ctx
                return Assert-TextPresent $text
            }
            'textAbsent' {
                $text = tpl $verify.text $ctx
                return Assert-TextAbsent $text
            }
            'noErrorText' {
                return Assert-NoErrorText
            }
            'dialogOpen' {
                return Assert-DialogOpen
            }
            'dialogClosed' {
                return Assert-DialogClosed
            }
            'rowVisible' {
                $text = tpl $verify.text $ctx
                return Assert-RowVisible $text
            }
            'apiReturns' {
                $url = tpl $verify.url $ctx
                $status = if ($verify.status) { $verify.status } else { 200 }
                return Assert-ApiReturns $url $status
            }
            'noNetwork5xx' {
                return Assert-NoNetwork5xx $ctx.networkLog
            }
            'noConsoleErrors' {
                return Assert-NoConsoleErrors $ctx.consoleLog
            }
            'fileDownloaded' {
                $ext = if ($verify.ext) { $verify.ext } else { 'csv' }
                return Assert-FileDownloaded $ctx.screenshotDir $ext
            }
            default {
                return @{ ok = $false; type = $type; reason = "unknown verify type: $type" }
            }
        }
    } catch {
        return @{ ok = $false; type = $type; reason = $_.Exception.Message }
    }
}
