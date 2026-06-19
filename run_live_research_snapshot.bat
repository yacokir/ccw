@echo off
setlocal enabledelayedexpansion

echo ========================================
echo CCW Live Research Snapshot Workflow
echo ========================================
echo Read-only research workflow. No orders are placed.
echo.

echo [1/4] Refresh live market data
node src\scripts\refresh_live_research_data.js
if errorlevel 1 goto fail
echo.

echo [2/4] Build live monitoring signals
node src\scripts\build_live_monitoring_signals.js
if errorlevel 1 goto fail
echo.

echo [3/4] Refresh live option discovery
node src\scripts\refresh_live_option_discovery.js
if errorlevel 1 goto fail
echo.

echo [4/4] Generate live research snapshot
node src\scripts\generate_live_research_snapshot.js --mode=t0 --btcCurrentHedge=0 --ethCurrentHedge=0 --btcNormalCounter=0 --ethNormalCounter=0
if errorlevel 1 goto fail
echo.

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set SNAPSHOT_DATE=%%i
set SNAPSHOT_PATH=live\snapshots\%SNAPSHOT_DATE%_live_snapshot.md

echo ========================================
echo Workflow complete
echo ========================================
echo Final snapshot:
echo %SNAPSHOT_PATH%
echo.
echo Open the snapshot with:
echo notepad %SNAPSHOT_PATH%
exit /b 0

:fail
echo.
echo ========================================
echo Workflow failed
echo ========================================
echo Stopped after a command returned a non-zero exit code.
exit /b 1
