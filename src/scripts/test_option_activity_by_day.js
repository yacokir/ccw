const { getOHLCData } = require('../data/deribit');

function getExpiryCode(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

function generateFridayCycles(startDate, endDate) {
  const cycles = [];
  const current = new Date(startDate);

  while (current.getUTCDay() !== 5) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (current <= endDate) {
    const entry = new Date(current);
    entry.setUTCHours(8, 0, 0, 0);
    const exit = new Date(current);
    exit.setUTCDate(exit.getUTCDate() + 7);
    exit.setUTCHours(8, 0, 0, 0);

    cycles.push({ entry: entry.getTime(), exit: exit.getTime() });
    current.setUTCDate(current.getUTCDate() + 7);
  }

  return cycles;
}

function generateBroadStrikeRange(S_entry) {
  const min = Math.floor(S_entry * 0.80 / 1000) * 1000;
  const max = Math.ceil(S_entry * 1.30 / 1000) * 1000;
  const strikes = [];
  for (let strike = min; strike <= max; strike += 1000) {
    strikes.push(strike);
  }
  return strikes;
}

async function main() {
  const startDate = '2025-04-04';
  const endDate = '2025-05-09';
  const underlying = 'BTC-PERPETUAL';
  const resolution = 60;

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const cycles = generateFridayCycles(startDateObj, endDateObj);

  let totalCycles = 0;
  let cyclesWithActive = 0;
  let cyclesWithZeroActive = 0;

  console.log('cycle,entry,expiry,S_entry,active_call_count,active_strikes,first_activity_times');

  for (let i = 0; i < cycles.length; i++) {
    totalCycles += 1;
    const cycle = cycles[i];
    const entryTime = cycle.entry;
    const exitTime = cycle.exit;
    const entryDate = new Date(entryTime);
    const expiry = getExpiryCode(new Date(exitTime));

    const entryDayStart = new Date(entryDate);
    entryDayStart.setUTCHours(0, 0, 0, 0);
    const nextDayStart = new Date(entryDayStart);
    nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

    const spotData = await getOHLCData(underlying, entryTime, entryTime + 60 * 1000, resolution);
    const spotCandleIndex = spotData.ticks.indexOf(entryTime);
    const S_entry = spotCandleIndex === -1 ? null : spotData.open[spotCandleIndex];

    const activeStrikes = [];
    const firstActivityTimes = [];
    let activeCount = 0;

    if (S_entry !== null) {
      const strikes = generateBroadStrikeRange(S_entry);
      for (const strike of strikes) {
        const instrumentName = `BTC-${expiry}-${strike}-C`;
        try {
          const data = await getOHLCData(instrumentName, entryDayStart.getTime(), nextDayStart.getTime(), resolution);
          if (data.status === 'ok' && Array.isArray(data.ticks) && data.ticks.length > 0) {
            activeCount += 1;
            activeStrikes.push(strike);
            firstActivityTimes.push(new Date(data.ticks[0]).toISOString());
          }
        } catch (error) {
          // Skip instrument errors to keep diagnostics simple
        }
      }
    }

    if (activeCount > 0) {
      cyclesWithActive += 1;
    } else {
      cyclesWithZeroActive += 1;
    }

    console.log(`${i + 1},${entryDate.toISOString()},${expiry},${S_entry !== null ? S_entry.toFixed(2) : 'null'},${activeCount},${activeStrikes.join('|')},${firstActivityTimes.join('|')}`);
  }

  console.log('\nTotals:');
  console.log(`total_cycles_checked: ${totalCycles}`);
  console.log(`cycles_with_any_active_call: ${cyclesWithActive}`);
  console.log(`cycles_with_zero_active_calls: ${cyclesWithZeroActive}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running option activity diagnostic:', error.message);
    process.exit(1);
  });
}
