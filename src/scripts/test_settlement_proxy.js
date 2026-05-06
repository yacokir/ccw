const { getOHLCData } = require('../data/deribit');
const { getCandleAt } = require('../data/ohlc');

const SETTLEMENT_PROXY_SOURCE = 'BTC_USD';
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
    return {
      found: false,
      timestamp: null,
      open: null,
      close: null
    };
  }

  return {
    found: true,
    timestamp: new Date(candle.timestamp).toISOString(),
    open: candle.open,
    close: candle.close
  };
}

async function fetchChartData(source, start, end, resolution) {
  try {
    const data = await getOHLCData(source, start, end, resolution);
    return {
      ok: true,
      source,
      data,
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      source,
      data: null,
      error: error.message
    };
  }
}

function getExactCandle(fetchResult, timestamp) {
  if (!fetchResult.ok || !fetchResult.data) return null;
  return getCandleAt(fetchResult.data, timestamp);
}

function simulateSettlementProxy(proxyResult, exposureResult, timestamp) {
  const proxyCandle = getExactCandle(proxyResult, timestamp);

  if (proxyCandle && proxyCandle.open) {
    return {
      fallbackWouldOccur: false,
      settlementPrice: proxyCandle.open,
      settlementSource: SETTLEMENT_PROXY_SOURCE,
      note: 'Using BTC_USD OHLC proxy for option settlement.'
    };
  }

  const exposureCandle = getExactCandle(exposureResult, timestamp);

  return {
    fallbackWouldOccur: true,
    settlementPrice: exposureCandle ? exposureCandle.open : null,
    settlementSource: EXPOSURE_SOURCE,
    note: proxyResult.ok
      ? 'BTC_USD exact candle missing; fallback would use BTC-PERPETUAL if available.'
      : `BTC_USD fetch failed: ${proxyResult.error}`
  };
}

function printFetchSummary(result) {
  if (!result.ok) {
    console.log(`${result.source}: fetch failed`);
    console.log(`  error: ${result.error}`);
    return;
  }

  const ticks = result.data.ticks || [];
  console.log(`${result.source}: fetch ok`);
  console.log(`  status: ${result.data.status}`);
  console.log(`  candles: ${ticks.length}`);

  if (ticks.length > 0) {
    console.log(`  first: ${new Date(ticks[0]).toISOString()} open=${result.data.open[0]}`);
    console.log(`  last:  ${new Date(ticks[ticks.length - 1]).toISOString()} open=${result.data.open[ticks.length - 1]}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const start = new Date(args.start || '2025-10-03T08:00:00Z').getTime();
  const hours = args.hours !== undefined ? Number(args.hours) : 3;
  const resolution = args.resolution !== undefined ? String(args.resolution) : '60';
  const end = start + hours * 60 * 60 * 1000;

  if (!Number.isFinite(start) || !Number.isFinite(hours) || hours <= 0) {
    throw new Error('Invalid args. Example: node src/scripts/test_settlement_proxy.js --start=2025-10-03T08:00:00Z --hours=3');
  }

  const timestamps = [];
  for (let timestamp = start; timestamp < end; timestamp += Number(resolution) * 60 * 1000) {
    timestamps.push(timestamp);
  }

  console.log('=== Settlement Proxy Diagnostic ===');
  console.log(`Window: ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`);
  console.log(`Resolution: ${resolution}`);
  console.log(`Settlement proxy source: ${SETTLEMENT_PROXY_SOURCE}`);
  console.log(`BTC exposure source: ${EXPOSURE_SOURCE}`);
  console.log('');

  const [proxyResult, exposureResult] = await Promise.all([
    fetchChartData(SETTLEMENT_PROXY_SOURCE, start, end, resolution),
    fetchChartData(EXPOSURE_SOURCE, start, end, resolution)
  ]);

  printFetchSummary(proxyResult);
  printFetchSummary(exposureResult);
  console.log('');

  console.log('=== Candle Comparison ===');
  for (const timestamp of timestamps) {
    const proxyCandle = getExactCandle(proxyResult, timestamp);
    const exposureCandle = getExactCandle(exposureResult, timestamp);
    const settlement = simulateSettlementProxy(proxyResult, exposureResult, timestamp);

    console.log(new Date(timestamp).toISOString());
    console.log(`  ${SETTLEMENT_PROXY_SOURCE}:`, formatCandle(proxyCandle));
    console.log(`  ${EXPOSURE_SOURCE}:`, formatCandle(exposureCandle));
    console.log(`  settlement simulation: price=${settlement.settlementPrice} source=${settlement.settlementSource}`);
    console.log(`  fallback would occur: ${settlement.fallbackWouldOccur ? 'YES' : 'NO'}`);
    console.log(`  note: ${settlement.note}`);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running settlement proxy diagnostic:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { simulateSettlementProxy };
