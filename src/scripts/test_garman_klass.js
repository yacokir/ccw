const { getOHLCData } = require('../data/deribit');
const { computeGarmanKlassVolatility } = require('../models/volatility/garman_klass');

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

function chartDataToCandles(chartData) {
  const ticks = chartData.ticks || [];
  return ticks.map((timestamp, index) => ({
    timestamp,
    open: chartData.open[index],
    high: chartData.high[index],
    low: chartData.low[index],
    close: chartData.close[index]
  }));
}

async function main() {
  const args = parseArgs(process.argv);
  const instrument = args.instrument || 'BTC-PERPETUAL';
  const resolution = args.resolution || '1D';
  const days = args.days !== undefined ? Number(args.days) : 30;
  const hours = args.hours !== undefined ? Number(args.hours) : days * 24;
  const periodsPerYear = args.periodsPerYear !== undefined ? Number(args.periodsPerYear) : 365;
  const end = args.end ? new Date(args.end).getTime() : Date.now();
  const start = args.start ? new Date(args.start).getTime() : end - hours * 60 * 60 * 1000;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('Invalid time window. Use --start and --end ISO timestamps, or --hours.');
  }

  console.log('=== Garman-Klass Volatility Diagnostic ===');
  console.log(`Instrument: ${instrument}`);
  console.log(`Window: ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`);
  console.log(`Resolution: ${resolution}`);
  console.log(`Annualization periods: ${periodsPerYear}`);
  console.log('');

  const data = await getOHLCData(instrument, start, end, resolution);
  const candles = chartDataToCandles(data);
  const result = computeGarmanKlassVolatility(candles, { periodsPerYear });

  console.log('Data:');
  console.log({
    status: data.status,
    fetchedCandles: candles.length,
    firstCandle: candles[0] ? new Date(candles[0].timestamp).toISOString() : null,
    lastCandle: candles.length > 0 ? new Date(candles[candles.length - 1].timestamp).toISOString() : null
  });

  console.log('');
  console.log('Volatility:');
  console.log({
    annualizedVolatility: result.annualizedVolatility,
    annualizedVolatilityPct: result.annualizedVolatility !== null ? result.annualizedVolatility * 100 : null
  });

  console.log('');
  console.log('Diagnostics:');
  console.log(result.diagnostics);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running Garman-Klass diagnostic:', error.message);
    process.exitCode = 1;
  });
}
