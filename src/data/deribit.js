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

async function getIndexChartData(indexName, range) {
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

module.exports = { getOHLCData, getIndexChartData, fetchInstruments };
