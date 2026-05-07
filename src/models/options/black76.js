function normalCdf(x) {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * erf);
}

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function toFiniteNumber(value, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateInputs(inputs) {
  const forwardPrice = toPositiveNumber(inputs.forwardPrice);
  const strike = toPositiveNumber(inputs.strike);
  const timeToExpiryYears = toPositiveNumber(inputs.timeToExpiryYears);
  const volatility = toPositiveNumber(inputs.volatility);
  const riskFreeRate = toFiniteNumber(inputs.riskFreeRate, 0);

  const errors = [];
  if (forwardPrice === null) errors.push('forwardPrice_must_be_positive');
  if (strike === null) errors.push('strike_must_be_positive');
  if (timeToExpiryYears === null) errors.push('timeToExpiryYears_must_be_positive');
  if (volatility === null) errors.push('volatility_must_be_positive');
  if (riskFreeRate === null) errors.push('riskFreeRate_must_be_finite');

  return {
    valid: errors.length === 0,
    errors,
    values: {
      forwardPrice,
      strike,
      timeToExpiryYears,
      volatility,
      riskFreeRate
    }
  };
}

function computeD1D2(forwardPrice, strike, timeToExpiryYears, volatility) {
  const sigmaSqrtT = volatility * Math.sqrt(timeToExpiryYears);
  const d1 = (Math.log(forwardPrice / strike) + 0.5 * volatility * volatility * timeToExpiryYears) / sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;
  return { d1, d2 };
}

function invalidResult(errors) {
  return {
    price: null,
    diagnostics: {
      valid: false,
      errors,
      d1: null,
      d2: null
    }
  };
}

// Black-76 prices options on a forward/futures-style underlying. That matches
// this research better than spot Black-Scholes while BTC exposure is proxied
// with perpetual/futures-like prices rather than a cash spot carry model.
function black76CallPrice(inputs) {
  const validation = validateInputs(inputs);
  if (!validation.valid) return invalidResult(validation.errors);

  const { forwardPrice, strike, timeToExpiryYears, volatility, riskFreeRate } = validation.values;
  const { d1, d2 } = computeD1D2(forwardPrice, strike, timeToExpiryYears, volatility);
  const discountFactor = Math.exp(-riskFreeRate * timeToExpiryYears);
  const price = discountFactor * (forwardPrice * normalCdf(d1) - strike * normalCdf(d2));

  return {
    price,
    diagnostics: {
      valid: true,
      errors: [],
      d1,
      d2,
      discountFactor,
      forwardPrice,
      strike,
      timeToExpiryYears,
      volatility,
      riskFreeRate
    }
  };
}

function black76PutPrice(inputs) {
  const validation = validateInputs(inputs);
  if (!validation.valid) return invalidResult(validation.errors);

  const { forwardPrice, strike, timeToExpiryYears, volatility, riskFreeRate } = validation.values;
  const { d1, d2 } = computeD1D2(forwardPrice, strike, timeToExpiryYears, volatility);
  const discountFactor = Math.exp(-riskFreeRate * timeToExpiryYears);
  const price = discountFactor * (strike * normalCdf(-d2) - forwardPrice * normalCdf(-d1));

  return {
    price,
    diagnostics: {
      valid: true,
      errors: [],
      d1,
      d2,
      discountFactor,
      forwardPrice,
      strike,
      timeToExpiryYears,
      volatility,
      riskFreeRate
    }
  };
}

module.exports = {
  black76CallPrice,
  black76PutPrice
};
