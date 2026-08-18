. "$PSScriptRoot\wb.ps1"
. "$PSScriptRoot\wb-dom.ps1"

function Assert-UrlMatches($pattern) {
    $url = Get-CurrentUrl
    $ok = $url -match $pattern
    return @{ ok = $ok; type = 'urlMatches'; url = $url; pattern = $pattern }
}

function Assert-TextPresent($text) {
    $body = Get-PageText
    $ok = $body -match [regex]::Escape($text)
    return @{ ok = $ok; type = 'textPresent'; text = $text }
}

function Assert-TextAbsent($text) {
    $body = Get-PageText
    $ok = $body -notmatch [regex]::Escape($text)
    return @{ ok = $ok; type = 'textAbsent'; text = $text }
}

function Assert-NoErrorText {
    $body = Get-PageText
    $patterns = @('Internal Server Error', '502 Bad Gateway', '503 Service Unavailable', 'Application Error', 'Terjadi kesalahan')
    foreach ($p in $patterns) {
        if ($body -match [regex]::Escape($p)) {
            return @{ ok = $false; type = 'noErrorText'; found = $p }
        }
    }
    return @{ ok = $true; type = 'noErrorText' }
}

function Assert-DialogOpen {
    $code = '(() => !!document.querySelector("[role=dialog], [data-state=open], .dialog, .modal"))()'
    $res = wbeval $code
    return @{ ok = ($res.value -eq $true); type = 'dialogOpen' }
}

function Assert-DialogClosed {
    $code = '(() => !document.querySelector("[role=dialog], [data-state=open], .dialog, .modal"))()'
    $res = wbeval $code
    return @{ ok = ($res.value -eq $true); type = 'dialogClosed' }
}

function Assert-RowVisible($text) {
    $body = Get-PageText
    $ok = $body -match [regex]::Escape($text)
    return @{ ok = $ok; type = 'rowVisible'; text = $text }
}

function Assert-ApiReturns($url, $status = 200) {
    $code = @"
(async () => {
  const res = await fetch('$url', { credentials: 'include' });
  return { status: res.status, ok: res.ok };
})()
"@
    $res = wbeval $code
    $ok = $res.value.ok -and $res.value.status -eq $status
    return @{ ok = $ok; type = 'apiReturns'; url = $url; status = $res.value.status; expected = $status }
}

function Assert-NoNetwork5xx($networkLog) {
    $fails = @()
    foreach ($req in $networkLog) {
        if ($req.status -ge 500) { $fails += $req }
    }
    return @{ ok = ($fails.Count -eq 0); type = 'noNetwork5xx'; fails = $fails }
}

function Assert-NoConsoleErrors($consoleLog) {
    $errors = @()
    foreach ($entry in $consoleLog) {
        if ($entry.level -eq 'error') { $errors += $entry }
    }
    return @{ ok = ($errors.Count -eq 0); type = 'noConsoleErrors'; errors = $errors }
}

function Assert-FileDownloaded($dir, $ext) {
    $files = Get-ChildItem $dir -Filter "*.$ext" -ErrorAction SilentlyContinue
    return @{ ok = ($files.Count -gt 0); type = 'fileDownloaded'; files = $files.Name }
}
