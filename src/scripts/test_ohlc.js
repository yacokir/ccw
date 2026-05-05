const { getOHLCData } = require('../data/deribit');
const { getCandleAt } = require('../data/ohlc');

async function testOHLC() {
  try {
    const start = new Date("2025-10-03T08:00:00Z").getTime();
    const end = new Date("2025-10-03T09:00:00Z").getTime();

    console.log('Fetching OHLC data for BTC-PERPETUAL...');
    console.log(`Time window: ${new Date(start).toISOString()} to ${new Date(end).toISOString()}`);

    const data = await getOHLCData('BTC-PERPETUAL', start, end, 60);

    const candle = getCandleAt(data, start);

    console.log('Candle:', candle);
    console.log({
      candleTimestamp: candle.timestamp,
      candleOpen: candle.open,
      candleClose: candle.close,
    });

    console.log({
      status: data.status,
      candles: data.ticks.length,
      first: new Date(data.ticks[0]).toISOString(),
      last: new Date(data.ticks[data.ticks.length - 1]).toISOString(),
      firstOpen: data.open[0],
      firstClose: data.close[0],
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOHLC();
