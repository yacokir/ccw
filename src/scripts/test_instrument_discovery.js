const { getOHLCData } = require('../data/deribit');
const { getCandleAt } = require('../data/ohlc');

function getExpiryCode(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

function generateCandidateStrikes(target, strikeRange, strikeStep) {
  const strikes = [];
  const min = Math.ceil((target - strikeRange) / strikeStep) * strikeStep;
  const max = Math.floor((target + strikeRange) / strikeStep) * strikeStep;
  for (let strike = min; strike <= max; strike += strikeStep) {
    strikes.push(strike);
  }
  return strikes;
}

function generateFridayCycles(startDate, endDate, entryHourUtc, entryMinuteUtc) {
  const cycles = [];
  const current = new Date(startDate);

  while (current.getUTCDay() !== 5) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (current <= endDate) {
    const entry = new Date(current);
    entry.setUTCHours(entryHourUtc, entryMinuteUtc, 0, 0);
    const exit = new Date(current);
    exit.setUTCDate(exit.getUTCDate() + 7);
    exit.setUTCHours(8, 0, 0, 0);

    cycles.push({ entry: entry.getTime(), exit: exit.getTime() });
    current.setUTCDate(current.getUTCDate() + 7);
  }

  return cycles;
}

async function main() {
  const startDate = '2025-04-04';
  const endDate = '2026-05-01';
  const xOtm = 0.05;
  const underlying = 'BTC-PERPETUAL';
  const strikeStep = 500;
  const strikeRange = 3000;
  const entryHourUtc = 8;
  const entryMinuteUtc = 0;
  const optionLookaheadMinutes = 60;
  const optionWindowEndOffset = optionLookaheadMinutes * 60 * 1000;

  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const cycles = generateFridayCycles(startDateObj, endDateObj, entryHourUtc, entryMinuteUtc);

  let totalValidInstruments = 0;
  let totalEmptyResponses = 0;
  let totalErrors = 0;
  let cyclesWithValid = 0;
  let cyclesWithZeroValid = 0;

  console.log('cycle,entry,expiry,S_entry,target,strikes_tested,valid_count,empty_count,error_count,valid_strikes');

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    const entryTime = cycle.entry;
    const exitTime = cycle.exit;
    const entryDate = new Date(entryTime);
    const expiry = getExpiryCode(new Date(exitTime));

    const spotData = await getOHLCData(underlying, entryTime, entryTime + 60 * 1000, 60);
    const spotCandle = getCandleAt(spotData, entryTime);
    const S_entry = spotCandle ? spotCandle.open : null;
    const target = S_entry !== null ? S_entry * (1 + xOtm) : null;

    const strikes = S_entry !== null ? generateCandidateStrikes(target, strikeRange, strikeStep) : [];
    let validCount = 0;
    let emptyCount = 0;
    let errorCount = 0;
    const validStrikes = [];

    if (S_entry !== null) {
      for (const strike of strikes) {
        const instrumentName = `BTC-${expiry}-${strike}-C`;
        try {
          const data = await getOHLCData(instrumentName, entryTime, entryTime + optionWindowEndOffset, 60);
          if (data.status === 'ok') {
            if (Array.isArray(data.ticks) && data.ticks.length > 0) {
              validCount += 1;
              validStrikes.push(strike);
            } else {
              emptyCount += 1;
            }
          } else {
            errorCount += 1;
          }
        } catch (err) {
          errorCount += 1;
        }
      }
    }

    totalValidInstruments += validCount;
    totalEmptyResponses += emptyCount;
    totalErrors += errorCount;

    if (validCount > 0) {
      cyclesWithValid += 1;
    } else {
      cyclesWithZeroValid += 1;
    }

    const entryLabel = entryDate.toISOString();
    const validStrikesLabel = validStrikes.length > 0 ? validStrikes.join('|') : '';
    console.log(`${i + 1},${entryLabel},${expiry},${S_entry !== null ? S_entry.toFixed(2) : 'null'},${target !== null ? target.toFixed(2) : 'null'},${strikes.length},${validCount},${emptyCount},${errorCount},${validStrikesLabel}`);
  }

  console.log('\nTotals:');
  console.log(`total_cycles: ${cycles.length}`);
  console.log(`cycles_with_valid_option: ${cyclesWithValid}`);
  console.log(`cycles_with_zero_valid_options: ${cyclesWithZeroValid}`);
  console.log(`total_valid_instruments: ${totalValidInstruments}`);
  console.log(`total_empty_responses: ${totalEmptyResponses}`);
  console.log(`total_errors: ${totalErrors}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error in instrument discovery test:', error.message);
    process.exit(1);
  });
}
