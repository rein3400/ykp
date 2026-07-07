@echo off
setlocal
REM ====== EDIT THESE BEFORE RUNNING ======
set "MT5_LOGIN=REPLACE_ME_LOGIN"
set "MT5_PASSWORD=REPLACE_ME_PASSWORD"
set "MT5_SERVER=REPLACE_ME_SERVER"
set "MT5_BRIDGE_TOKEN=REPLACE_ME_64HEX"
set "PYTHON_EXE=%LocalAppData%\Programs\Python\Python311\python.exe"
set "SVC_DIR=%~dp0\.."
set "LOGS_DIR=%SVC_DIR%\logs"
REM ======================================

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

where nssm >nul 2>&1
if errorlevel 1 (
  echo [nssm] not found in PATH. Download nssm.cc, copy nssm.exe to C:\Tools\nssm\, add to PATH.
  exit /b 1
)

nssm install YKPMT5Bridge "%PYTHON_EXE%" "-m uvicorn mt5_bridge.app:app --host 127.0.0.1 --port 8765 --workers 1"
nssm set YKPMT5Bridge AppDirectory "%SVC_DIR%"
nssm set YKPMT5Bridge AppEnvironmentExtra MT5_LOGIN=%MT5_LOGIN% MT5_PASSWORD=%MT5_PASSWORD% MT5_SERVER=%MT5_SERVER% MT5_BRIDGE_TOKEN=%MT5_BRIDGE_TOKEN%
nssm set YKPMT5Bridge Start SERVICE_AUTO_START
nssm set YKPMT5Bridge AppRestartDelay 5000
nssm set YKPMT5Bridge AppStdout "%LOGS_DIR%\service.out.log"
nssm set YKPMT5Bridge AppStderr "%LOGS_DIR%\service.err.log"
nssm set YKPMT5Bridge AppRotateFiles 1
nssm set YKPMT5Bridge AppRotateBytes 10485760
nssm set YKPMT5Bridge DisplayName "YKP MetaTrader5 Bridge"

nssm start YKPMT5Bridge
if errorlevel 1 (
  echo [nssm] start failed. Run 'nssm status YKPMT5Bridge' for diagnostics.
  exit /b 1
)
echo [nssm] YKPMT5Bridge installed + started.
endlocal