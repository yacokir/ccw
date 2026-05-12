@echo off

echo Running ATM...
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_atm00_2020_2026 --model=moneyness

echo Running ITM05...
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_itm05_2020_2026 --model=moneyness

echo Running OTM03...
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm03_2020_2026 --model=moneyness

echo Running OTM07...
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm07_2020_2026 --model=moneyness

echo Running OTM10...
node src\scripts\analyze_execution_friction.js --batch=runs\batches\batch_years_otm10_2020_2026 --model=moneyness

echo.
echo Done.
pause