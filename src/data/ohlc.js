function getCandleAt(chartData, timestamp) {
  const index = chartData.ticks.indexOf(timestamp);
  
  if (index === -1) {
    return null;
  }
  
  return {
    timestamp: chartData.ticks[index],
    open: chartData.open[index],
    high: chartData.high[index],
    low: chartData.low[index],
    close: chartData.close[index],
    volume: chartData.volume[index],
  };
}

// Get candle at exact timestamp, or first available candle after timestamp
function getCandleAtOrAfter(chartData, timestamp) {
  const index = chartData.ticks.findIndex(tick => tick >= timestamp);
  
  if (index === -1) {
    return null;
  }
  
  return {
    timestamp: chartData.ticks[index],
    open: chartData.open[index],
    high: chartData.high[index],
    low: chartData.low[index],
    close: chartData.close[index],
    volume: chartData.volume[index],
  };
}

module.exports = { getCandleAt, getCandleAtOrAfter };
