@echo off
setlocal enabledelayedexpansion

cd /d C:\Users\Yaco\Desktop\ccw

if not exist logs\live_monitoring mkdir logs\live_monitoring

for /f %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd')"') do set SNAPSHOT_DATE=%%i
for /f %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd_HHmmss')"') do set LOG_STAMP=%%i
for /f "delims=" %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set WRAPPER_START=%%i

set SNAPSHOT_PATH=live\snapshots\%SNAPSHOT_DATE%_daily_monitoring_snapshot.md
set REPORT_PATH=live\ACTIVE_MONITORING_DAILY.md
set HTML_REPORT_PATH=live\reports\ACTIVE_MONITORING_DAILY.html
set TIMELINE_PATH=live\LIVE_POSITION_TIMELINE.md
set TIMELINE_HTML_PATH=live\reports\LIVE_POSITION_TIMELINE.html
set LOG_PATH=logs\live_monitoring\%LOG_STAMP%_daily_auto.log

set PREVIOUS_SNAPSHOT_EXISTS=false
set PREVIOUS_SNAPSHOT_MTIME=N/A
if exist "%SNAPSHOT_PATH%" (
  set PREVIOUS_SNAPSHOT_EXISTS=true
  for /f "delims=" %%i in ('powershell -NoProfile -Command "$tz=[System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time'); $item=Get-Item -LiteralPath '%SNAPSHOT_PATH%'; [System.TimeZoneInfo]::ConvertTimeFromUtc($item.LastWriteTimeUtc, $tz).ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set PREVIOUS_SNAPSHOT_MTIME=%%i
)

echo ========================================>> "%LOG_PATH%"
echo CCW Live Daily Monitoring Auto Wrapper>> "%LOG_PATH%"
echo ========================================>> "%LOG_PATH%"
echo Wrapper start timestamp: %WRAPPER_START%>> "%LOG_PATH%"
echo Expected snapshot: %SNAPSHOT_PATH%>> "%LOG_PATH%"
echo Previous snapshot existed: %PREVIOUS_SNAPSHOT_EXISTS%>> "%LOG_PATH%"
echo Previous snapshot last modified: %PREVIOUS_SNAPSHOT_MTIME%>> "%LOG_PATH%"
echo.>> "%LOG_PATH%"

echo Running run_live_monitoring_daily.bat regardless of existing snapshot state.>> "%LOG_PATH%"
echo.>> "%LOG_PATH%"

call run_live_monitoring_daily.bat >> "%LOG_PATH%" 2>&1
set EXIT_CODE=%ERRORLEVEL%

set NEW_SNAPSHOT_MTIME=N/A
set REPORT_MTIME=N/A
set HTML_REPORT_MTIME=N/A
set TIMELINE_MTIME=N/A
set TIMELINE_HTML_MTIME=N/A
if exist "%SNAPSHOT_PATH%" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "$tz=[System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time'); $item=Get-Item -LiteralPath '%SNAPSHOT_PATH%'; [System.TimeZoneInfo]::ConvertTimeFromUtc($item.LastWriteTimeUtc, $tz).ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set NEW_SNAPSHOT_MTIME=%%i
)
if exist "%REPORT_PATH%" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "$tz=[System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time'); $item=Get-Item -LiteralPath '%REPORT_PATH%'; [System.TimeZoneInfo]::ConvertTimeFromUtc($item.LastWriteTimeUtc, $tz).ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set REPORT_MTIME=%%i
)
if exist "%HTML_REPORT_PATH%" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "$tz=[System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time'); $item=Get-Item -LiteralPath '%HTML_REPORT_PATH%'; [System.TimeZoneInfo]::ConvertTimeFromUtc($item.LastWriteTimeUtc, $tz).ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set HTML_REPORT_MTIME=%%i
)
if exist "%TIMELINE_PATH%" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "$tz=[System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time'); $item=Get-Item -LiteralPath '%TIMELINE_PATH%'; [System.TimeZoneInfo]::ConvertTimeFromUtc($item.LastWriteTimeUtc, $tz).ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set TIMELINE_MTIME=%%i
)
if exist "%TIMELINE_HTML_PATH%" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "$tz=[System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time'); $item=Get-Item -LiteralPath '%TIMELINE_HTML_PATH%'; [System.TimeZoneInfo]::ConvertTimeFromUtc($item.LastWriteTimeUtc, $tz).ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set TIMELINE_HTML_MTIME=%%i
)
for /f "delims=" %%i in ('powershell -NoProfile -Command "[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), 'Eastern Standard Time').ToString('yyyy-MM-dd HH:mm:ss') + ' America/New_York'"') do set WRAPPER_FINISH=%%i

echo.>> "%LOG_PATH%"
echo Expected snapshot: %SNAPSHOT_PATH%>> "%LOG_PATH%"
echo New snapshot last modified: %NEW_SNAPSHOT_MTIME%>> "%LOG_PATH%"
echo Report last modified: %REPORT_MTIME%>> "%LOG_PATH%"
echo HTML report last modified: %HTML_REPORT_MTIME%>> "%LOG_PATH%"
echo Timeline last modified: %TIMELINE_MTIME%>> "%LOG_PATH%"
echo Timeline HTML last modified: %TIMELINE_HTML_MTIME%>> "%LOG_PATH%"
echo Wrapper finish timestamp: %WRAPPER_FINISH%>> "%LOG_PATH%"
>> "%LOG_PATH%" echo Exit code: %EXIT_CODE%
echo Finished with exit code %EXIT_CODE%.>> "%LOG_PATH%"
exit /b %EXIT_CODE%
