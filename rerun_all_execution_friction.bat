@echo off

echo ========================================
echo ATM00 - UNIFORM
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_atm00_2020_2026 --model=uniform

echo ========================================
echo ATM00 - MONEYNESS
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_atm00_2020_2026 --model=moneyness


echo ========================================
echo ITM05 - UNIFORM
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_itm05_2020_2026 --model=uniform

echo ========================================
echo ITM05 - MONEYNESS
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_itm05_2020_2026 --model=moneyness


echo ========================================
echo OTM03 - UNIFORM
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm03_2020_2026 --model=uniform

echo ========================================
echo OTM03 - MONEYNESS
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm03_2020_2026 --model=moneyness


echo ========================================
echo OTM05 - UNIFORM
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm05_2020_2026 --model=uniform

echo ========================================
echo OTM05 - MONEYNESS
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm05_2020_2026 --model=moneyness


echo ========================================
echo OTM07 - UNIFORM
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm07_2020_2026 --model=uniform

echo ========================================
echo OTM07 - MONEYNESS
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm07_2020_2026 --model=moneyness


echo ========================================
echo OTM10 - UNIFORM
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm10_2020_2026 --model=uniform

echo ========================================
echo OTM10 - MONEYNESS
echo ========================================
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm10_2020_2026 --model=moneyness


echo.
echo ========================================
echo ALL EXECUTION FRICTION ANALYSES COMPLETED
echo ========================================

pause