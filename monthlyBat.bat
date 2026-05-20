@echo off
cd /d C:\Users\Yaco\Desktop\ccw

echo ============================================
echo BTC MONTHLY BATCHES (FINAL)
echo ============================================

echo.
echo Running ATM monthly...
node src/scripts/run_batch_years.js --startYear=2020 --endYear=2026 --xOtm=0 --tenor=monthly

echo.
echo Running OTM03 monthly...
node src/scripts/run_batch_years.js --startYear=2020 --endYear=2026 --xOtm=0.03 --tenor=monthly

echo.
echo Running OTM05 monthly...
node src/scripts/run_batch_years.js --startYear=2020 --endYear=2026 --xOtm=0.05 --tenor=monthly

echo.
echo Running OTM07 monthly...
node src/scripts/run_batch_years.js --startYear=2020 --endYear=2026 --xOtm=0.07 --tenor=monthly

echo.
echo Running OTM10 monthly...
node src/scripts/run_batch_years.js --startYear=2020 --endYear=2026 --xOtm=0.10 --tenor=monthly

echo.
echo ============================================
echo ALL MONTHLY BATCHES FINISHED
echo ============================================

pause
