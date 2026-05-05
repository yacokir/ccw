async function getOkxHistoryCandles(instId, startTimestamp, endTimestamp, bar = '1H') {
  const url = 'https://www.okx.com/api/v5/market/history-candles';
  const params = new URLSearchParams({
    instId,
    bar,
    after: String(endTimestamp),
    before: String(startTimestamp),
    limit: '100'
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    throw new Error(`OKX API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== '0') {
    throw new Error(`OKX API error: ${data.msg}`);
  }

  return data.data;
}

async function getOkxInstruments(instType = 'OPTION', uly = 'BTC-USD') {
  const url = 'https://www.okx.com/api/v5/public/instruments';
  const params = new URLSearchParams({
    instType,
    uly
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    throw new Error(`OKX API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== '0') {
    throw new Error(`OKX API error: ${data.msg}`);
  }

  return data.data;
}

module.exports = { getOkxHistoryCandles, getOkxInstruments };