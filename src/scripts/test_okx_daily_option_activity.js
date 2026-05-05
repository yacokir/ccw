const { getOkxHistoryCandles } = require('../data/okx_options');

function getNearestFridayExpiryCode(date) {
  const expiryDate = new Date(date);
  while (expiryDate.getUTCDay() !== 5) {
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 1);
  }
  const year = String(expiryDate.getUTCFullYear()).slice(-2);
  const month = String(expiryDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(expiryDate.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const startDate = '2025-04-01';
  const endDate = '2025-05-15';
  const underlying = 'BTC-USD';
  const bar = '1H';
  const requestDelayMs = 100;
  const strikeMin = 50000;
  const strikeMax = 150000;
  const strikeStep = 1000;

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  let totalDays = 0;
  let daysWithZeroActivity = 0;
  let totalActiveInstrumentInstances = 0;
  let totalTicksAcrossAllDays = 0;

  console.log('date,expiry,active_instruments,total_ticks');

  const current = new Date(startDateObj);
  current.setUTCHours(0, 0, 0, 0);

  while (current <= endDateObj) {
    totalDays += 1;

    const dayStart = new Date(current);
    const dayEnd = new Date(current);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const expiryCode = getNearestFridayExpiryCode(current);

    let activeInstruments = 0;
    let dayTotalTicks = 0;

    for (let strike = strikeMin; strike <= strikeMax; strike += strikeStep) {
      const instId = `BTC-USD-${expiryCode}-${strike}-C`;
      try {
        const candles = await getOkxHistoryCandles(instId, dayStart.getTime(), dayEnd.getTime(), bar);
        if (Array.isArray(candles) && candles.length > 0) {
          activeInstruments += 1;
          dayTotalTicks += candles.length;
        }
      } catch (error) {
        // Ignore individual request failures
      }
      await sleep(requestDelayMs);
    }

    if (activeInstruments === 0) {
      daysWithZeroActivity += 1;
    }

    totalActiveInstrumentInstances += activeInstruments;
    totalTicksAcrossAllDays += dayTotalTicks;

    const dateLabel = dayStart.toISOString().split('T')[0];
    console.log(`${dateLabel},${expiryCode},${activeInstruments},${dayTotalTicks}`);

    current.setUTCDate(current.getUTCDate() + 1);
  }

  const averageActiveInstrumentsPerDay = totalDays > 0 ? (totalActiveInstrumentInstances / totalDays).toFixed(2) : '0.00';

  console.log('\nTotals:');
  console.log(`total_days: ${totalDays}`);
  console.log(`days_with_zero_activity: ${daysWithZeroActivity}`);
  console.log(`average_active_instruments_per_day: ${averageActiveInstrumentsPerDay}`);
  console.log(`total_active_instrument_instances: ${totalActiveInstrumentInstances}`);
  console.log(`total_ticks_across_all_days: ${totalTicksAcrossAllDays}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running OKX daily option activity diagnostic:', error.message);
    process.exit(1);
  });
}
