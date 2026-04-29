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

module.exports = { getOHLCData };
