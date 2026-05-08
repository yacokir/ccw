const { getDeliveryPrices, getDeliveryPriceByDate, getOHLCData } = require('../data/deribit');
const { getCandleAt, getCandleAtOrAfter } = require('../data/ohlc');

const INDEX_NAME = 'btc_usd';
const EXPOSURE_SOURCE = 'BTC-PERPETUAL';
const DEFAULT_EXPIRY_HOUR_UTC = 8;

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

function formatPerpCandle(candle) {
  if (!candle) {
    return { found: false, timestamp: null, open: null };
  }

  return {
    found: true,
    timestamp: new Date(candle.timestamp).toISOString(),
    open: candle.open
  };
}

function expiryDateToTimestamp(dateString) {
  const normalizedDate = normalizeDateOnly(dateString);
  return new Date(`${normalizedDate}T${String(DEFAULT_EXPIRY_HOUR_UTC).padStart(2, '0')}:00:00Z`).getTime();
}

function normalizeDateOnly(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid delivery date: ${value}`);
  }

  return date.toISOString().slice(0, 10);
}

async function main() {
  const args = parseArgs(process.argv);
  const indexName = args.indexName || INDEX_NAME;
  const count = args.count !== undefined ? Number(args.count) : 10;

  console.log('=== Deribit Delivery Prices Diagnostic ===');
  console.log('Endpoint: public/get_delivery_prices');
  console.log(`Index name: ${indexName}`);
  console.log(`Recent records requested: ${count}`);
  console.log('');

  const recent = await getDeliveryPrices(indexName, 0, count);
  const records = Array.isArray(recent.data) ? recent.data : Array.isArray(recent) ? recent : [];

  console.log('Recent delivery records:');
  console.table(records.map(record => ({
    date: record.date,
    delivery_price: record.delivery_price
  })));

  const targetDate = args.date || (records[0] ? normalizeDateOnly(records[0].date) : null);
  if (!targetDate) {
    console.log('No delivery records returned; fallback would occur.');
    return;
  }

  console.log('');
  console.log(`Lookup date: ${targetDate}`);

  const lookup = await getDeliveryPriceByDate(indexName, targetDate);
  const deliveryPrice = lookup.found ? Number(lookup.deliveryPrice) : null;
  const exitTimestamp = expiryDateToTimestamp(lookup.date || targetDate);
  const perpData = await getOHLCData(EXPOSURE_SOURCE, exitTimestamp, exitTimestamp + 60 * 60 * 1000, 60);
  const perpCandle = getCandleAt(perpData, exitTimestamp) || getCandleAtOrAfter(perpData, exitTimestamp);

  console.log('Delivery lookup:');
  console.log({
    found: lookup.found,
    date: lookup.date,
    deliveryPrice: lookup.deliveryPrice,
    rawRecord: lookup.rawRecord
  });

  console.log('');
  console.log(`Comparison at ${new Date(exitTimestamp).toISOString()}:`);
  console.log(`  ${indexName} delivery_price: ${Number.isFinite(deliveryPrice) ? deliveryPrice : null}`);
  console.log(`  ${EXPOSURE_SOURCE}:`, formatPerpCandle(perpCandle));
  console.log('');
  console.log(`Fallback to ${EXPOSURE_SOURCE} would occur: ${lookup.found && Number.isFinite(deliveryPrice) && deliveryPrice > 0 ? 'NO' : 'YES'}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running delivery price diagnostic:', error.message);
    process.exitCode = 1;
  });
}
