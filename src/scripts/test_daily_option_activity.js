const { getOHLCData } = require('../data/deribit');

function getExpiryCode(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

function getNextFriday(date) {
  const d = new Date(date);
  while (d.getUTCDay() !== 5) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

async function main() {
  const startDate = '2025-04-01';
  const endDate = '2025-05-15';
  const resolution = 60;

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  let totalDays = 0;
  let daysWithZeroActivity = 0;
  let totalActiveInstruments = 0;
  let totalTicks = 0;

  console.log('date,active_instruments,total_ticks');

  let currentDate = new Date(startDateObj);
  currentDate.setUTCHours(0, 0, 0, 0);

  while (currentDate <= endDateObj) {
    totalDays += 1;

    const dayStart = new Date(currentDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const fridayDate = getNextFriday(currentDate);
    const expiry = getExpiryCode(fridayDate);

    let activeInstruments = 0;
    let dayTotalTicks = 0;

    // Generate broad strike range 50k to 150k, step 1000
    for (let strike = 50000; strike <= 150000; strike += 1000) {
      const instrumentName = `BTC-${expiry}-${strike}-C`;
      try {
        const data = await getOHLCData(instrumentName, dayStart.getTime(), dayEnd.getTime(), resolution);
        if (data.status === 'ok' && Array.isArray(data.ticks) && data.ticks.length > 0) {
          activeInstruments += 1;
          dayTotalTicks += data.ticks.length;
        }
      } catch (error) {
        // Skip errors
      }
    }

    if (activeInstruments === 0) {
      daysWithZeroActivity += 1;
    }

    totalActiveInstruments += activeInstruments;
    totalTicks += dayTotalTicks;

    const dateLabel = dayStart.toISOString().split('T')[0];
    console.log(`${dateLabel},${activeInstruments},${dayTotalTicks}`);

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  const avgActive = totalDays > 0 ? (totalActiveInstruments / totalDays).toFixed(2) : 0;
  console.log('\nTotals:');
  console.log(`total_days: ${totalDays}`);
  console.log(`days_with_zero_activity: ${daysWithZeroActivity}`);
  console.log(`average_active_instruments_per_day: ${avgActive}`);
  console.log(`total_active_instrument_instances: ${totalActiveInstruments}`);
  console.log(`total_ticks_across_all_days: ${totalTicks}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running daily option activity measurement:', error.message);
    process.exit(1);
  });
}
