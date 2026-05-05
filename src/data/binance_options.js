async function getBinanceOptionKlines(symbol, startTimestamp, endTimestamp, interval = '1h') {
  const url = 'https://eapi.binance.com/eapi/v1/klines';
  const params = new URLSearchParams({
    symbol,
    interval,
    startTime: String(startTimestamp),
    endTime: String(endTimestamp),
    limit: '1500'
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== undefined || data.msg !== undefined) {
    const message = data.msg || JSON.stringify(data);
    throw new Error(`Binance API error: ${message}`);
  }

  return data;
}

module.exports = { getBinanceOptionKlines };