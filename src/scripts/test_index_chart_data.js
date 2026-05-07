const { getOHLCData, getIndexChartOhlcData } = require('../data/deribit');
const { getCandleAt, getCandleAtOrAfter } = require('../data/ohlc');

const INDEX_NAME = 'btc_usd';
const EXPOSURE_SOURCE = 'BTC-PERPETUAL';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const keyValue = arg.slice(2);
    if (keyValue.includes('=')) {
      const [key, value] = keyValue.split('=');
      args[key] = value;
    } else {
      const next = argv[i + 1];
      args[keyValue] = next && !next.startsWith('--') ? next : true;
      if (args[keyValue] === next) i++;
    }
  }
  return args;
}

function formatCandle(candle) {
  if (!candle) {
    return { found: false, timestamp: null, open: null };
  }

  return {
    found: true,
    timestamp: new Date(candle.timestamp).toISOString(),
    open: candle.open
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const range = args.range || '1d';
  const lookbackHours = args.lookbackHours !== undefined ? Number(args.lookbackHours) : 6;
  const end = args.end ? new Date(args.end).getTime() : Date.now();
  const start = args.start ? new Date(args.start).getTime() : end - lookbackHours * 60 * 60 * 1000;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('Invalid window. Example: node src/scripts/test_index_chart_data.js --range=1d --lookbackHours=6');
  }

  console.log('=== Deribit Index Chart Diagnostic ===');
  console.log(`Index endpoint: public/get_index_chart_data`);
  console.log(`Index name: ${INDEX_NAME}`);
  console.log(`Range: ${range}`);
  console.log(`Filter window: ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`);
  console.log('');

  const indexData = await getIndexChartOhlcData(INDEX_NAME, start, end, range);
  const latestIndexTimestamp = indexData.ticks.length > 0 ? indexData.ticks[indexData.ticks.length - 1] : null;
  const latestIndexCandle = latestIndexTimestamp !== null ? getCandleAt(indexData, latestIndexTimestamp) : null;

  console.log('Index data:');
  console.log({
    status: indexData.status,
    points: indexData.ticks.length,
    first: indexData.ticks.length > 0 ? new Date(indexData.ticks[0]).toISOString() : null,
    last: latestIndexTimestamp !== null ? new Date(latestIndexTimestamp).toISOString() : null,
    latestOpen: latestIndexCandle ? latestIndexCandle.open : null,
    metadata: indexData.metadata
  });
  console.log('');

  let perpCandle = null;
  if (latestIndexTimestamp !== null) {
    const perpStart = latestIndexTimestamp;
    const perpEnd = latestIndexTimestamp + 60 * 60 * 1000;
    const perpData = await getOHLCData(EXPOSURE_SOURCE, perpStart, perpEnd, 60);
    perpCandle = getCandleAt(perpData, latestIndexTimestamp) || getCandleAtOrAfter(perpData, latestIndexTimestamp);
  }

  console.log('Comparison near latest index timestamp:');
  console.log(`  ${INDEX_NAME}:`, formatCandle(latestIndexCandle));
  console.log(`  ${EXPOSURE_SOURCE}:`, formatCandle(perpCandle));
  console.log('');
  console.log(`Settlement index proxy works: ${latestIndexCandle ? 'YES' : 'NO'}`);
  console.log(`Fallback to ${EXPOSURE_SOURCE} would occur: ${latestIndexCandle ? 'NO' : 'YES'}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running index chart diagnostic:', error.message);
    process.exitCode = 1;
  });
}
