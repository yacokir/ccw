@echo off
setlocal enabledelayedexpansion

cd /d C:\Users\Yaco\Desktop\ccw

if not exist logs\live_monitoring mkdir logs\live_monitoring

for /f %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd')"') do set SNAPSHOT_DATE=%%i
for /f %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd_HHmmss')"') do set LOG_STAMP=%%i

set SNAPSHOT_PATH=live\snapshots\%SNAPSHOT_DATE%_daily_monitoring_snapshot.md
set LOG_PATH=logs\live_monitoring\%LOG_STAMP%_daily_auto.log

echo ========================================>> "%LOG_PATH%"
echo CCW Live Daily Monitoring Auto Wrapper>> "%LOG_PATH%"
echo ========================================>> "%LOG_PATH%"
echo Started at NY: %LOG_STAMP%>> "%LOG_PATH%"
echo Expected snapshot: %SNAPSHOT_PATH%>> "%LOG_PATH%"
echo.>> "%LOG_PATH%"

if exist "%SNAPSHOT_PATH%" (
  echo Snapshot already exists for %SNAPSHOT_DATE%. Nothing to do.>> "%LOG_PATH%"
  echo Existing snapshot: %SNAPSHOT_PATH%>> "%LOG_PATH%"
  exit /b 0
)

echo Snapshot not found. Running run_live_monitoring_daily.bat...>> "%LOG_PATH%"
echo.>> "%LOG_PATH%"

call run_live_monitoring_daily.bat >> "%LOG_PATH%" 2>&1
set EXIT_CODE=%ERRORLEVEL%

echo.>> "%LOG_PATH%"
echo Finished with exit code %EXIT_CODE%.>> "%LOG_PATH%"
exit /b %EXIT_CODE%
