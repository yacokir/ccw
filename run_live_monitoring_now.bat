@echo off
setlocal enabledelayedexpansion

echo ========================================
echo CCW Live Active Monitoring - Manual
echo ========================================
echo Read-only research workflow. No orders are placed.
echo Uses live\position_register.json. No option discovery is performed.
echo.

echo [1/4] Refresh live market data
node src\scripts\refresh_live_research_data.js
if errorlevel 1 goto fail
echo.

echo [2/4] Build live monitoring signals
node src\scripts\build_live_monitoring_signals.js
if errorlevel 1 goto fail
echo.

echo [3/4] Refresh registered position monitoring
node src\scripts\refresh_live_position_monitoring.js
if errorlevel 1 goto fail
echo.

echo [4/4] Generate active manual monitoring snapshot
node src\scripts\generate_live_research_snapshot.js --mode=manual --btcNormalCounter=0 --ethNormalCounter=0
if errorlevel 1 goto fail
echo.

for /f %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'America/New_York').ToString('yyyy-MM-dd_HHmm')"') do set SNAPSHOT_STAMP=%%i
set SNAPSHOT_PATH=live\snapshots\%SNAPSHOT_STAMP%_NY_manual_monitoring_snapshot.md

echo ========================================
echo Manual monitoring complete
echo ========================================
echo Final snapshot:
echo %SNAPSHOT_PATH%
exit /b 0

:fail
echo.
echo ========================================
echo Workflow failed
echo ========================================
echo Stopped after a command returned a non-zero exit code.
exit /b 1
