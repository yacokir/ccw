const { getOHLCData } = require('../data/deribit');

async function testOHLC() {
  try {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    console.log('Fetching OHLC data for BTC-PERPETUAL...');
    console.log(`Time window: ${new Date(oneDayAgo).toISOString()} to ${new Date(now).toISOString()}`);

    const data = await getOHLCData('BTC-PERPETUAL', oneDayAgo, now, 60);

    console.log('OHLC Data:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testOHLC();
