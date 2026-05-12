@echo off

echo ========================================
echo OTM 03
echo ========================================
node src/scripts/analyze_execution_friction.js --batch=runs/batches/batch_years_otm03_2020_2026

echo.
echo ========================================
echo ITM 05
echo ========================================
node src/scripts/analyze_execution_friction.js --batch=runs/batches/batch_years_itm05_2020_2026

echo.
echo ========================================
echo OTM 07
echo ========================================
node src/scripts/analyze_execution_friction.js --batch=runs/batches/batch_years_otm07_2020_2026

echo.
echo ========================================
echo OTM 10
echo ========================================
node src/scripts/analyze_execution_friction.js --batch=runs/batches/batch_years_otm10_2020_2026

echo.
echo Finished all friction analyses.
pause