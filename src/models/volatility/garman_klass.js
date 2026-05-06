const DEFAULT_PERIODS_PER_YEAR = 365;

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function validateCandle(candle) {
  if (!candle || typeof candle !== 'object') {
    return { valid: false, reason: 'missing_candle' };
  }

  const open = toPositiveNumber(candle.open);
  const high = toPositiveNumber(candle.high);
  const low = toPositiveNumber(candle.low);
  const close = toPositiveNumber(candle.close);

  if (open === null || high === null || low === null || close === null) {
    return { valid: false, reason: 'missing_or_non_positive_ohlc' };
  }

  if (high < low) {
    return { valid: false, reason: 'high_less_than_low' };
  }

  return {
    valid: true,
    candle: { open, high, low, close }
  };
}

function incrementReason(reasons, reason) {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

function computeGarmanKlassVolatility(candles, options = {}) {
  const periodsPerYear = options.periodsPerYear || DEFAULT_PERIODS_PER_YEAR;

  if (!Array.isArray(candles)) {
    throw new TypeError('candles must be an array');
  }

  if (!Number.isFinite(periodsPerYear) || periodsPerYear <= 0) {
    throw new TypeError('periodsPerYear must be a positive number');
  }

  let varianceSum = 0;
  let validCandleCount = 0;
  let skippedCandleCount = 0;
  const skippedReasons = {};

  for (const rawCandle of candles) {
    const validation = validateCandle(rawCandle);

    if (!validation.valid) {
      skippedCandleCount++;
      incrementReason(skippedReasons, validation.reason);
      continue;
    }

    const { open, high, low, close } = validation.candle;
    const highLowLog = Math.log(high / low);
    const closeOpenLog = Math.log(close / open);
    const candleVariance =
      0.5 * highLowLog * highLowLog -
      (2 * Math.log(2) - 1) * closeOpenLog * closeOpenLog;

    if (!Number.isFinite(candleVariance) || candleVariance < 0) {
      skippedCandleCount++;
      incrementReason(skippedReasons, 'invalid_variance');
      continue;
    }

    varianceSum += candleVariance;
    validCandleCount++;
  }

  const variance = validCandleCount > 0 ? varianceSum / validCandleCount : null;
  const annualizedVolatility = variance !== null ? Math.sqrt(variance * periodsPerYear) : null;

  return {
    annualizedVolatility,
    diagnostics: {
      validCandleCount,
      skippedCandleCount,
      skippedReasons,
      variance,
      periodsPerYear
    }
  };
}

module.exports = { computeGarmanKlassVolatility };
