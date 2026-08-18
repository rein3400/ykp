. "$PSScriptRoot\wb.ps1"

function nav($url, $name, $newTab = $false, $groupTitle = $null) {
    $navArgs = @{
        url = $url
        newTab = $newTab
    }
    if ($groupTitle) { $navArgs.group_title = $groupTitle }
    $res = wbjson "navigate" $navArgs $script:WbSession
    if (-not $res.ok) { throw "navigate failed: $($res | ConvertTo-Json -Compress)" }
    return $res.data
}

function snap($name) {
    $res = wbjson "snapshot" @{} $script:WbSession
    if (-not $res.ok) { throw "snapshot failed: $($res | ConvertTo-Json -Compress)" }
    return $res.data
}

function shot($name, $path) {
    $shotArgs = @{ format = "png" }
    if ($path) { $shotArgs.path = $path }
    $res = wbjson "screenshot" $shotArgs $script:WbSession
    if (-not $res.ok) { throw "screenshot failed: $($res | ConvertTo-Json -Compress)" }
    return $res.data
}

function clickRef($ref) {
    $res = wbjson "click" @{ selector = $ref } $script:WbSession
    if (-not $res.ok) { throw "click failed: $($res | ConvertTo-Json -Compress)" }
    return $res.data
}

function fillRef($ref, $value) {
    $res = wbjson "fill" @{ selector = $ref; value = $value } $script:WbSession
    if (-not $res.ok) { throw "fill failed: $($res | ConvertTo-Json -Compress)" }
    return $res.data
}

function wbeval($code) {
    $res = wbjson "evaluate" @{ code = $code } $script:WbSession
    if (-not $res.ok) { throw "evaluate failed: $($res | ConvertTo-Json -Compress)" }
    return $res.data
}

function Find-RefByText($text, $role = $null) {
    $snapshot = snap "find-ref"
    $refs = @()
    function walk($node) {
        if ($node.name -match $text) {
            if (-not $role -or $node.role -eq $role) {
                if ($node.ref) { $refs += $node.ref }
            }
        }
        foreach ($child in $node.children) { walk $child }
    }
    foreach ($node in $snapshot.tree) { walk $node }
    return $refs
}

function clickText($text, $role = "button") {
    $refs = Find-RefByText $text $role
    if ($refs.Count -eq 0) { throw "No element found with text: $text" }
    if ($refs.Count -gt 1) { Write-Warning "Multiple elements found for text: $text, using first" }
    return clickRef $refs[0]
}

function fillByLabel($label, $value) {
    $escaped = $label -replace "'", "\\'"
    $code = @"
(() => {
  const inputs = [...document.querySelectorAll('input, textarea')];
  for (const inp of inputs) {
    const aria = inp.getAttribute('aria-label') || '';
    const placeholder = inp.getAttribute('placeholder') || '';
    const id = inp.id;
    const lbl = id ? document.querySelector(`label[for="${id}"]`) : null;
    const labelText = lbl ? lbl.innerText : '';
    if (aria.toLowerCase().includes('$escaped'.toLowerCase()) ||
        placeholder.toLowerCase().includes('$escaped'.toLowerCase()) ||
        labelText.toLowerCase().includes('$escaped'.toLowerCase())) {
      return inp.id ? '#' + inp.id : inp.name ? `[name="${inp.name}"]` : null;
    }
  }
  return null;
})()
"@
    $res = wbeval $code
    if (-not $res.value) { throw "No input found for label: $label" }
    return fillRef $res.value $value
}

function waitForText($text, $timeoutMs = 10000) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
        $res = wbeval "(() => document.body.innerText.toLowerCase().includes('$text'.toLowerCase()))()"
        if ($res.value -eq $true) { return $true }
        Start-Sleep -Milliseconds 500
    }
    throw "Timeout waiting for text: $text"
}

function waitSettled($ms = 1500) {
    Start-Sleep -Milliseconds $ms
}

function Confirm-Override($returnValue = $false) {
    $val = if ($returnValue) { "true" } else { "false" }
    $code = @"
(() => {
  window.__confirmCalls = [];
  window.confirm = function(m) { window.__confirmCalls.push(m); return $val; };
  return true;
})()
"@
    return wbeval $code
}

function Confirm-Read {
    $code = "(() => JSON.stringify(window.__confirmCalls || []))()"
    $res = wbeval $code
    return $res.value | ConvertFrom-Json
}

function Close-Dialog {
    $code = @"
(() => {
  const closeBtn = document.querySelector('[role="dialog"] button[aria-label*="close" i], [role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Tutup")');
  if (closeBtn) { closeBtn.click(); return true; }
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
  return false;
})()
"@
    return wbeval $code
}

function Send-Key($key) {
    $code = "document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'$key', bubbles:true}))"
    return wbeval $code
}

function Get-PageText {
    $res = wbeval "(() => document.body.innerText)()"
    return $res.value
}

function Get-CurrentUrl {
    $res = wbeval "(() => location.href)()"
    return $res.value
}
