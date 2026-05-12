@echo off

echo Removing legacy generic execution friction files...

del /S /Q runs\batches\*\analysis\execution_friction\uniform\execution_friction_summary.csv
del /S /Q runs\batches\*\analysis\execution_friction\uniform\execution_friction_summary.json

del /S /Q runs\batches\*\analysis\execution_friction\moneyness\execution_friction_summary.csv
del /S /Q runs\batches\*\analysis\execution_friction\moneyness\execution_friction_summary.json

echo.
echo Cleanup completed.
pause