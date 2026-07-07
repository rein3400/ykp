@echo off
setlocal
cd /d "%~dp0\.."
call .venv\Scripts\activate.bat

if not defined MT5_LOGIN     set "MT5_LOGIN=0"
if not defined MT5_PASSWORD  set "MT5_PASSWORD="
if not defined MT5_SERVER    set "MT5_SERVER="
if not defined MT5_BRIDGE_TOKEN set "MT5_BRIDGE_TOKEN=local-dev"

uvicorn mt5_bridge.app:app --host 127.0.0.1 --port 8765 --reload
endlocal