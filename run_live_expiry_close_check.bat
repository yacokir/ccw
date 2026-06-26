@echo off
setlocal

echo ========================================
echo CCW Live Expiry Close Check
echo ========================================
echo Read-only operational check. No orders are placed.
echo Does not modify live\position_register.json.
echo Does not generate daily snapshots.
echo.

node src\scripts\generate_live_expiry_close_check.js
if errorlevel 1 goto fail

echo.
echo ========================================
echo Expiry close check complete
echo ========================================
echo Reports:
echo live\reports\EXPIRY_CLOSE_CHECK_*.md
echo live\reports\EXPIRY_CLOSE_CHECK_*.html
echo live\reports\EXPIRY_CLOSE_CHECK_*.json
exit /b 0

:fail
echo.
echo ========================================
echo Expiry close check failed
echo ========================================
echo Stopped after the generator returned a non-zero exit code.
exit /b 1
