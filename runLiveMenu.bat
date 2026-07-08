@echo off
setlocal enabledelayedexpansion

set "CONSOLE_TITLE=CCW Live Console v0.2"

:main_menu
cls
echo ========================================
echo %CONSOLE_TITLE%
echo ========================================
echo.
echo 1 - Open / Roll Cycle
echo 2 - Monitor Active Cycle
echo 3 - Position ^& Hedge
echo 4 - Expiry / Close Cycle
echo 5 - Reports
echo 6 - Maintenance / Diagnostics
echo 0 - Exit
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" goto menu_open_roll
if "%CHOICE%"=="2" goto menu_monitor
if "%CHOICE%"=="3" goto menu_position_hedge
if "%CHOICE%"=="4" goto menu_expiry
if "%CHOICE%"=="5" goto menu_reports
if "%CHOICE%"=="6" goto menu_maintenance
if "%CHOICE%"=="0" goto exit_menu
if /i "%CHOICE%"=="ESC" goto exit_menu

call :invalid "1, 2, 3, 4, 5, 6, or 0"
goto main_menu

:menu_open_roll
cls
echo ========================================
echo Open / Roll Cycle
echo ========================================
echo.
echo 1 - Run T0 Discovery
echo 0 - Back
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" (
  call :run_wrapper "run_live_t0_discovery.bat" "T0 Discovery"
  goto menu_open_roll
)
if "%CHOICE%"=="0" goto main_menu
if /i "%CHOICE%"=="ESC" goto main_menu

call :invalid "1 or 0"
goto menu_open_roll

:menu_monitor
cls
echo ========================================
echo Monitor Active Cycle
echo ========================================
echo.
echo 1 - Daily Monitoring
echo 2 - Manual Monitoring Now
echo 0 - Back
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" (
  call :run_wrapper "run_live_monitoring_daily.bat" "Daily Monitoring"
  goto menu_monitor
)
if "%CHOICE%"=="2" (
  call :run_wrapper "run_live_monitoring_now.bat" "Manual Monitoring Now"
  goto menu_monitor
)
if "%CHOICE%"=="0" goto main_menu
if /i "%CHOICE%"=="ESC" goto main_menu

call :invalid "1, 2, or 0"
goto menu_monitor

:menu_position_hedge
cls
echo ========================================
echo Position ^& Hedge
echo ========================================
echo.
echo 1 - Show Position Register
echo 2 - Refresh Position / Hedge Summary
echo 0 - Back
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" (
  call :show_register
  goto menu_position_hedge
)
if "%CHOICE%"=="2" (
  call :run_wrapper "run_live_pnl_hedge_summary_now.bat" "Position / Hedge Summary"
  goto menu_position_hedge
)
if "%CHOICE%"=="0" goto main_menu
if /i "%CHOICE%"=="ESC" goto main_menu

call :invalid "1, 2, or 0"
goto menu_position_hedge

:menu_expiry
cls
echo ========================================
echo Expiry / Close Cycle
echo ========================================
echo.
echo 1 - Expiry Close Check
echo 2 - Cycle Final Result
echo 0 - Back
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" (
  call :run_wrapper "run_live_expiry_close_check.bat" "Expiry Close Check"
  goto menu_expiry
)
if "%CHOICE%"=="2" (
  call :not_available "Cycle Final Result wrapper not found"
  goto menu_expiry
)
if "%CHOICE%"=="0" goto main_menu
if /i "%CHOICE%"=="ESC" goto main_menu

call :invalid "1, 2, or 0"
goto menu_expiry

:menu_reports
cls
echo ========================================
echo Reports
echo ========================================
echo.
echo 1 - Open ACTIVE_MONITORING_DAILY.html
echo 2 - Open LIVE_POSITION_TIMELINE.html
echo 3 - Open latest EXPIRY_CLOSE_CHECK html/md/json
echo 4 - Open latest CYCLE_FINAL_RESULT md/json
echo 0 - Back
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" (
  call :open_file "live\reports\ACTIVE_MONITORING_DAILY.html"
  goto menu_reports
)
if "%CHOICE%"=="2" (
  call :open_file "live\reports\LIVE_POSITION_TIMELINE.html"
  goto menu_reports
)
if "%CHOICE%"=="3" (
  call :open_latest "EXPIRY_CLOSE_CHECK" "html md json"
  goto menu_reports
)
if "%CHOICE%"=="4" (
  call :open_latest "CYCLE_FINAL_RESULT" "md json"
  goto menu_reports
)
if "%CHOICE%"=="0" goto main_menu
if /i "%CHOICE%"=="ESC" goto main_menu

call :invalid "1, 2, 3, 4, or 0"
goto menu_reports

:menu_maintenance
cls
echo ========================================
echo Maintenance / Diagnostics
echo ========================================
echo.
echo 1 - Daily Auto Check
echo 2 - Environment Check
echo 3 - JavaScript Syntax Check for live scripts
echo 0 - Back
echo.
call :read_choice "Select an option: "

if "%CHOICE%"=="1" (
  call :run_wrapper "run_live_monitoring_daily_auto_check.bat" "Daily Auto Check"
  goto menu_maintenance
)
if "%CHOICE%"=="2" (
  call :environment_check
  goto menu_maintenance
)
if "%CHOICE%"=="3" (
  call :syntax_check
  goto menu_maintenance
)
if "%CHOICE%"=="0" goto main_menu
if /i "%CHOICE%"=="ESC" goto main_menu

call :invalid "1, 2, 3, or 0"
goto menu_maintenance

:show_register
cls
echo ========================================
echo Position Register
echo ========================================
echo.
if exist "live\position_register.json" (
  type "live\position_register.json"
) else (
  echo No active Position Register found at live\position_register.json.
)
echo.
call :wait
exit /b 0

:environment_check
cls
echo ========================================
echo Environment Check
echo ========================================
echo.
echo Not available yet: Environment Check wrapper not found.
echo.
call :wait
exit /b 0

:syntax_check
cls
echo ========================================
echo JavaScript Syntax Check for live scripts
echo ========================================
echo.
set "CHECK_FAILED=0"
call :node_check "src\scripts\load_local_env.js"
call :node_check "src\scripts\ccw_env_diagnostics.js"
call :node_check "src\scripts\bybit_readonly_account_client.js"
call :node_check "src\scripts\bybit_account_sync.js"
call :node_check "src\scripts\live_accounting.js"
call :node_check "src\scripts\refresh_live_research_data.js"
call :node_check "src\scripts\build_live_monitoring_signals.js"
call :node_check "src\scripts\refresh_live_option_discovery.js"
call :node_check "src\scripts\refresh_live_position_monitoring.js"
call :node_check "src\scripts\generate_live_research_snapshot.js"
call :node_check "src\scripts\generate_live_expiry_close_check.js"
call :node_check "src\scripts\print_live_pnl_hedge_summary.js"
echo.
if "%CHECK_FAILED%"=="0" (
  echo Syntax check OK.
) else (
  echo Syntax check failed.
)
echo.
call :wait
exit /b %CHECK_FAILED%

:node_check
if exist "%~1" (
  echo Checking %~1
  node --check "%~1"
  if errorlevel 1 set "CHECK_FAILED=1"
) else (
  echo Not available yet: %~1 not found.
  set "CHECK_FAILED=1"
)
exit /b 0

:run_wrapper
cls
echo ========================================
echo %~2
echo ========================================
echo.
if exist "%~1" (
  call "%~1"
) else (
  echo Wrapper not found: %~1
)
echo.
call :wait
exit /b 0

:open_file
cls
echo ========================================
echo Open Report
echo ========================================
echo.
if exist "%~1" (
  echo Opening %~1
  if defined CCW_MENU_DRY_OPEN (
    echo DRY OPEN: start "" "%~1"
  ) else (
    start "" "%~1"
  )
) else (
  echo Not available yet: %~1 not found.
)
echo.
call :wait
exit /b 0

:open_latest
cls
echo ========================================
echo Open Latest %~1 Report
echo ========================================
echo.
set "LATEST_REPORT="
for %%E in (%~2) do (
  if not defined LATEST_REPORT (
    for /f "delims=" %%F in ('dir /b /a-d /o-d "live\reports\%~1_*.%%E" 2^>nul') do (
      if not defined LATEST_REPORT set "LATEST_REPORT=live\reports\%%F"
    )
  )
)

if defined LATEST_REPORT (
  echo Opening !LATEST_REPORT!
  if defined CCW_MENU_DRY_OPEN (
    echo DRY OPEN: start "" "!LATEST_REPORT!"
  ) else (
    start "" "!LATEST_REPORT!"
  )
) else (
  echo Not available yet: no live\reports\%~1 report found.
)
echo.
call :wait
exit /b 0

:not_available
cls
echo ========================================
echo Not Available
echo ========================================
echo.
echo Not available yet: %~1.
echo.
call :wait
exit /b 0

:invalid
echo.
echo Invalid option. Please choose %~1.
call :wait
exit /b 0

:read_choice
set "CHOICE="
if defined CCW_MENU_TEST_CHOICE (
  set "CHOICE=%CCW_MENU_TEST_CHOICE%"
) else (
  set /p "CHOICE=%~1"
)
if not defined CHOICE set "CHOICE=ESC"
exit /b 0

:wait
if defined CCW_MENU_NO_PAUSE exit /b 0
pause
exit /b 0

:exit_menu
echo.
echo Exiting %CONSOLE_TITLE%.
exit /b 0
