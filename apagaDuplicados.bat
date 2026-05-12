@echo off

echo Removing legacy generic execution friction files...

for /R runs\batches %%F in (execution_friction_summary.csv) do del /Q "%%F"
for /R runs\batches %%F in (execution_friction_summary.json) do del /Q "%%F"

echo.
echo Cleanup completed.
pause