@echo off
setlocal

node src\scripts\refresh_live_research_data.js >nul 2>&1
if errorlevel 1 goto fail

node src\scripts\build_live_monitoring_signals.js >nul 2>&1
if errorlevel 1 goto fail

node src\scripts\refresh_live_position_monitoring.js >nul 2>&1
if errorlevel 1 goto fail

node src\scripts\print_live_pnl_hedge_summary.js
if errorlevel 1 goto fail

exit /b 0

:fail
echo.
echo PnL / hedge summary failed. Refresh or summary command returned a non-zero exit code.
exit /b 1
