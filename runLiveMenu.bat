@echo off
setlocal

:menu
cls
echo ========================================
echo CCW Live Operations Menu
echo ========================================
echo.
echo 1 - T0 Discovery
echo 2 - Daily Monitoring
echo 3 - Manual Monitoring Now
echo 4 - Show Position Register
echo 0 - Exit
echo.
set "CHOICE="
set /p CHOICE=Select an option: 
if not defined CHOICE goto exit_menu

if "%CHOICE%"=="1" goto t0_discovery
if "%CHOICE%"=="2" goto daily_monitoring
if "%CHOICE%"=="3" goto manual_monitoring
if "%CHOICE%"=="4" goto show_register
if "%CHOICE%"=="0" goto exit_menu

echo.
echo Invalid option. Please choose 1, 2, 3, 4, or 0.
call :wait
goto menu

:t0_discovery
cls
call run_live_t0_discovery.bat
echo.
call :wait
goto menu

:daily_monitoring
cls
call run_live_monitoring_daily.bat
echo.
call :wait
goto menu

:manual_monitoring
cls
call run_live_monitoring_now.bat
echo.
call :wait
goto menu

:show_register
cls
echo ========================================
echo Position Register
echo ========================================
echo.
if exist live\position_register.json (
  type live\position_register.json
) else (
  echo No active Position Register found at live\position_register.json.
)
echo.
call :wait
goto menu

:exit_menu
echo.
echo Exiting CCW Live Operations Menu.
exit /b 0

:wait
if defined CCW_MENU_NO_PAUSE exit /b 0
pause
exit /b 0
