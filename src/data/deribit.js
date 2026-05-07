async function getOHLCData(instrumentName, startTimestamp, endTimestamp, resolution) {
  const url = 'https://www.deribit.com/api/v2/public/get_tradingview_chart_data';
  
  const params = new URLSearchParams({
    instrument_name: instrumentName,
    start_timestamp: String(startTimestamp),
    end_timestamp: String(endTimestamp),
    resolution: String(resolution)
  });

  const response = await fetch(`${url}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Deribit API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deribit API error: ${data.error.message}`);
  }

  return data.result;
}

async function getIndexChartData(indexName, range = '1m') {
  const url = 'https://www.deribit.com/api/v2/public/get_index_chart_data';
  
  const params = new URLSearchParams({
    index_name: indexName,
    range: range
  });

  const response = await fetch(`${url}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Deribit API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deribit API error: ${data.error.message}`);
  }

  return data.result;
}

function indexChartPointsToOhlc(points, startTimestamp, endTimestamp, metadata = {}) {
  if (!Array.isArray(points)) {
    throw new Error('Deribit index chart response result must be an array');
  }

  const parsedPoints = points
    .filter(point => Array.isArray(point) && point.length >= 2)
    .map(([timestamp, price]) => [Number(timestamp), Number(price)])
    .filter(([timestamp, price]) => Number.isFinite(timestamp) && Number.isFinite(price) && price > 0)
    .filter(([timestamp]) => timestamp >= startTimestamp && timestamp <= endTimestamp)
    .sort(([a], [b]) => a - b);

  return {
    status: parsedPoints.length > 0 ? 'ok' : 'no_data',
    ticks: parsedPoints.map(([timestamp]) => timestamp),
    open: parsedPoints.map(([, price]) => price),
    high: parsedPoints.map(([, price]) => price),
    low: parsedPoints.map(([, price]) => price),
    close: parsedPoints.map(([, price]) => price),
    volume: parsedPoints.map(() => 0),
    metadata: {
      source_type: 'deribit_index_chart_points',
      ohlc_note: 'Index chart endpoint returns timestamp/price points; open/high/low/close are all set to the point price.',
      requested_start_timestamp: startTimestamp,
      requested_end_timestamp: endTimestamp,
      raw_point_count: points.length,
      filtered_point_count: parsedPoints.length,
      ...metadata
    }
  };
}

async function getIndexChartOhlcData(indexName, startTimestamp, endTimestamp, range = '1m') {
  const points = await getIndexChartData(indexName, range);
  return indexChartPointsToOhlc(points, startTimestamp, endTimestamp, {
    endpoint: 'public/get_index_chart_data',
    index_name: indexName,
    range
  });
}

async function fetchInstruments(currency = 'BTC', kind = 'option', expired = true) {
  const url = 'https://www.deribit.com/api/v2/public/get_instruments';
  
  const params = new URLSearchParams({
    currency: currency,
    kind: kind,
    expired: String(expired)
  });

  const response = await fetch(`${url}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Deribit API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Deribit API error: ${data.error.message}`);
  }

  return data.result;
}

module.exports = { getOHLCData, getIndexChartData, getIndexChartOhlcData, fetchInstruments };
