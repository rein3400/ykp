@echo off
where nssm >nul 2>&1
if errorlevel 1 (
  echo [nssm] not found in PATH.
  exit /b 1
)
nssm stop YKPMT5Bridge
timeout /t 3 /nobreak >nul
nssm remove YKPMT5Bridge confirm
echo [nssm] YKPMT5Bridge removed.