function tmp($body) {
    $name = "wb-" + [Guid]::NewGuid().ToString("N").Substring(0, 8) + ".json"
    $path = Join-Path $env:TEMP $name
    [System.IO.File]::WriteAllText($path, $body, [System.Text.UTF8Encoding]::new($false))
    return $path
}

function wb($body) {
    $f = tmp $body
    try {
        $out = curl.exe -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" --data-binary "@$f" --max-time 30
        return $out
    } finally {
        Remove-Item $f -Force -ErrorAction SilentlyContinue
    }
}

function wbjson($action, $cmdArgs = @{}, $session = $script:WbSession) {
    $bodyObj = @{
        action = $action
        args = $cmdArgs
        session = $session
    }
    $body = $bodyObj | ConvertTo-Json -Depth 10 -Compress
    $raw = wb $body
    try {
        return $raw | ConvertFrom-Json
    } catch {
        throw "Failed to parse WebBridge response: $raw"
    }
}

function Ensure-WbDaemon {
    try {
        $res = wbjson "list_tabs" @{} $script:WbSession
        return $true
    } catch {
        Write-Host "WebBridge daemon not reachable, starting..."
        & "$env:USERPROFILE\.kimi-webbridge\bin\kimi-webbridge.exe" start
        Start-Sleep -Seconds 2
        try {
            $res = wbjson "list_tabs" @{} $script:WbSession
            return $true
        } catch {
            throw "Failed to start WebBridge daemon: $_"
        }
    }
}
