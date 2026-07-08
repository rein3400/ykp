@echo off
setlocal
cd /d "%~dp0\.."

if not exist ".venv" (
  echo [install] creating venv ...
  python -m venv .venv
  if errorlevel 1 exit /b 1
)

call .venv\Scripts\activate.bat
echo [install] upgrading pip ...
python -m pip install --upgrade pip
echo [install] installing package + deps ...
pip install -e .
if errorlevel 1 exit /b 1

echo [install] creating logs dir ...
if not exist "logs" mkdir logs
echo [install] OK.
echo [install] For manual testing, edit scripts\run_manual_dev.bat then run it.
echo [install] For auto-start on boot (optional), edit nssm\install_service.bat then run as Administrator.
endlocal