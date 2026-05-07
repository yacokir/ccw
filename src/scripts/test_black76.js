const { black76CallPrice, black76PutPrice } = require('../models/options/black76');

const oneWeek = 7 / 365;

const scenarios = [
  {
    name: 'ATM 1-week call',
    input: {
      forwardPrice: 100000,
      strike: 100000,
      timeToExpiryYears: oneWeek,
      volatility: 0.6
    }
  },
  {
    name: 'OTM 1-week call',
    input: {
      forwardPrice: 100000,
      strike: 105000,
      timeToExpiryYears: oneWeek,
      volatility: 0.6
    }
  },
  {
    name: 'High-vol 1-week call',
    input: {
      forwardPrice: 100000,
      strike: 105000,
      timeToExpiryYears: oneWeek,
      volatility: 1.2
    }
  },
  {
    name: 'Invalid input example',
    input: {
      forwardPrice: 100000,
      strike: 0,
      timeToExpiryYears: oneWeek,
      volatility: 0.6
    }
  }
];

function printScenario(scenario) {
  const call = black76CallPrice(scenario.input);
  const put = black76PutPrice(scenario.input);

  console.log(`=== ${scenario.name} ===`);
  console.log('Input:', scenario.input);
  console.log('Call:', {
    price: call.price,
    d1: call.diagnostics.d1,
    d2: call.diagnostics.d2,
    valid: call.diagnostics.valid,
    errors: call.diagnostics.errors
  });
  console.log('Put:', {
    price: put.price,
    d1: put.diagnostics.d1,
    d2: put.diagnostics.d2,
    valid: put.diagnostics.valid,
    errors: put.diagnostics.errors
  });
  console.log('');
}

function main() {
  console.log('Black-76 diagnostic examples');
  console.log('Prices are in the same units as forwardPrice and strike.');
  console.log('Volatility is annualized decimal volatility, e.g. 0.6 = 60% annualized.');
  console.log('');

  scenarios.forEach(printScenario);
}

if (require.main === module) {
  main();
}
