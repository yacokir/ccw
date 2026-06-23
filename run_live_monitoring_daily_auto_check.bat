@echo off
setlocal enabledelayedexpansion

cd /d C:\Users\Yaco\Desktop\ccw

echo ========================================
echo CCW Live Daily Monitoring Auto Check
echo ========================================
echo Safe dry check. No snapshots or live data are generated.
echo.

set CHECK_FAILED=0

if exist run_live_monitoring_daily.bat (
  echo OK: run_live_monitoring_daily.bat
) else (
  echo MISSING: run_live_monitoring_daily.bat
  set CHECK_FAILED=1
)

if exist live\position_register.json (
  echo OK: live\position_register.json
) else (
  echo MISSING: live\position_register.json
  set CHECK_FAILED=1
)

if exist src\scripts\generate_live_research_snapshot.js (
  echo OK: src\scripts\generate_live_research_snapshot.js
) else (
  echo MISSING: src\scripts\generate_live_research_snapshot.js
  set CHECK_FAILED=1
)

if exist src\scripts\refresh_live_position_monitoring.js (
  echo OK: src\scripts\refresh_live_position_monitoring.js
) else (
  echo MISSING: src\scripts\refresh_live_position_monitoring.js
  set CHECK_FAILED=1
)

if exist src\scripts\bybit_readonly_account_client.js (
  echo OK: src\scripts\bybit_readonly_account_client.js
) else (
  echo MISSING: src\scripts\bybit_readonly_account_client.js
  set CHECK_FAILED=1
)

if exist src\scripts\bybit_account_sync.js (
  echo OK: src\scripts\bybit_account_sync.js
) else (
  echo MISSING: src\scripts\bybit_account_sync.js
  set CHECK_FAILED=1
)

if not "%CHECK_FAILED%"=="0" (
  echo.
  echo One or more required files are missing.
  exit /b 1
)

echo.
echo Checking JavaScript syntax...
node --check src\scripts\generate_live_research_snapshot.js
if errorlevel 1 exit /b 1
node --check src\scripts\refresh_live_position_monitoring.js
if errorlevel 1 exit /b 1
node --check src\scripts\bybit_readonly_account_client.js
if errorlevel 1 exit /b 1
node --check src\scripts\bybit_account_sync.js
if errorlevel 1 exit /b 1

for /f %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd')"') do set SNAPSHOT_DATE=%%i
set SNAPSHOT_PATH=live\snapshots\%SNAPSHOT_DATE%_daily_monitoring_snapshot.md

echo.
echo Expected daily snapshot for current NY date:
echo %SNAPSHOT_PATH%
echo.

if exist "%SNAPSHOT_PATH%" (
  echo Status: snapshot already exists.
) else (
  echo Status: snapshot does not exist yet.
)

echo.
echo Auto check OK. run_live_monitoring_daily.bat was not executed.
exit /b 0
