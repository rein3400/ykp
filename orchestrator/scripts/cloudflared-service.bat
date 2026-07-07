@echo off
setlocal
REM ====== EDIT THESE BEFORE RUNNING ======
set "CLOUDFLARE_TUNNEL_TOKEN=REPLACE_ME_CLOUDFLARE_TUNNEL_TOKEN"
set "CLOUDFLARED_EXE=C:\Tools\cloudflared\cloudflared.exe"
set "LOGS_DIR=C:\Tools\cloudflared"
REM ======================================

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"
where nssm >nul 2>&1
if errorlevel 1 (
  echo [nssm] not found in PATH. Download nssm.cc, copy nssm.exe to C:\Tools\nssm\, add to PATH.
  exit /b 1
)
if not exist "%CLOUDFLARED_EXE%" (
  echo [cloudflared] not found at %CLOUDFLARED_EXE%. Download latest from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  exit /b 1
)

nssm install YKPCloudflared "%CLOUDFLARED_EXE%" "tunnel --no-autoupdate run --token %CLOUDFLARE_TUNNEL_TOKEN%"
nssm set YKPCloudflared AppEnvironmentExtra CLOUDFLARE_TUNNEL_TOKEN=%CLOUDFLARE_TUNNEL_TOKEN%
nssm set YKPCloudflared Start SERVICE_AUTO_START
nssm set YKPCloudflared AppRestartDelay 5000
nssm set YKPCloudflared AppStdout "%LOGS_DIR%\out.log"
nssm set YKPCloudflared AppStderr "%LOGS_DIR%\err.log"
nssm set YKPCloudflared AppRotateFiles 1
nssm set YKPCloudflared AppRotateBytes 10485760
nssm set YKPCloudflared DisplayName "YKP Cloudflare Tunnel"
REM Tunnel must be able to reach host.docker.internal — depend on Docker Desktop.
nssm set YKPCloudflared DependOnService DockerDesktop

nssm start YKPCloudflared
if errorlevel 1 (
  echo [cloudflared] start failed. Run 'nssm status YKPCloudflared' for diagnostics.
  exit /b 1
)
echo [cloudflared] YKPCloudflared installed + started.
endlocal