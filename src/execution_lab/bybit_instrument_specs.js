const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const LAB_DIR = __dirname;
const REPO_ROOT = path.resolve(LAB_DIR, '..', '..');
const LOCAL_CONFIG_PATH = path.join(LAB_DIR, 'execution_lab_config.json');
const EXAMPLE_CONFIG_PATH = path.join(LAB_DIR, 'execution_lab_config.example.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'execution_lab', 'output');
const DEMO_BASE_URL = 'https://api-demo.bybit.com';
const LAB_CAPITAL_USDT = 2000;
const SCENARIO_UNDERLYING_QTYS = [0.01, 0.02, 0.05, 0.10];
const OPERATIONAL_BUFFER_RATE = 0.05;
const DEFAULT_CONFIG = {
  environment: 'demo',
  baseUrl: DEMO_BASE_URL,
  apiKey: '',
  apiSecret: '',
  recvWindow: 5000,
  accountType: 'UNIFIED'
};

function loadConfig() {
  const sourcePath = fs.existsSync(LOCAL_CONFIG_PATH) ? LOCAL_CONFIG_PATH : EXAMPLE_CONFIG_PATH;
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    sourcePath,
    recvWindow: String(parsed.recvWindow || DEFAULT_CONFIG.recvWindow)
  };
}

function validateConfig(config) {
  const errors = [];
  if (String(config.environment || '').toLowerCase() !== 'demo') {
    errors.push('Execution Lab Sprint 0D.1 only allows environment="demo".');
  }
  if (config.baseUrl !== DEMO_BASE_URL) {
    errors.push(`Execution Lab Sprint 0D.1 only allows baseUrl=${DEMO_BASE_URL}.`);
  }
  if (!config.apiKey || !config.apiSecret) {
    errors.push(`Missing demo credentials. Create ${LOCAL_CONFIG_PATH} from ${EXAMPLE_CONFIG_PATH}.`);
  }
  return errors;
}

function queryString(params) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function signGetRequest(config, timestamp, query) {
  const payload = `${timestamp}${config.apiKey}${config.recvWindow}${query}`;
  return crypto
    .createHmac('sha256', config.apiSecret)
    .update(payload)
    .digest('hex');
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method: 'GET', headers }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        let payload = null;
        try {
          payload = body ? JSON.parse(body) : null;
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${url}: ${body.slice(0, 200)}`));
          return;
        }
        if (payload && payload.retCode !== 0) {
          reject(new Error(`Bybit retCode ${payload.retCode}: ${payload.retMsg || 'unknown error'}`));
          return;
        }
        resolve(payload);
      });
    });
    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timeout from ${url}`));
    });
    request.on('error', reject);
    request.end();
  });
}

function bybitGet(config, pathname, params = {}) {
  const query = queryString(params);
  const timestamp = String(Date.now());
  const signature = signGetRequest(config, timestamp, query);
  const url = `${config.baseUrl}${pathname}${query ? `?${query}` : ''}`;
  return getJson(url, {
    'X-BAPI-API-KEY': config.apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-TYPE': '2',
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': config.recvWindow
  });
}

function bybitPublicGet(config, pathname, params = {}) {
  const query = queryString(params);
  const url = `${config.baseUrl}${pathname}${query ? `?${query}` : ''}`;
  return getJson(url);
}

async function capture(label, warnings, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    warnings.push(`${label} unavailable: ${error.message || String(error)}`);
    return fallback;
  }
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundNumber(value, decimals = 8) {
  const number = optionalNumber(value);
  if (number === null) return null;
  const multiplier = 10 ** decimals;
  return Math.round(number * multiplier) / multiplier;
}

function resultList(payload) {
  return payload && payload.result && Array.isArray(payload.result.list) ? payload.result.list : [];
}

function firstWalletAccount(walletPayload) {
  return resultList(walletPayload)[0] || {};
}

function walletCoins(walletPayload) {
  return resultList(walletPayload).flatMap(account => (account.coin || []).map(coin => ({
    accountType: account.accountType || null,
    coin: coin.coin || null,
    walletBalance: roundNumber(coin.walletBalance),
    equity: roundNumber(coin.equity),
    usdValue: roundNumber(coin.usdValue),
    free: roundNumber(coin.free)
  })));
}

function findCoin(wallet, coin) {
  return (wallet || []).find(row => row.coin === coin) || null;
}

function firstTicker(payload) {
  return resultList(payload)[0] || null;
}

function tickerPrice(payload) {
  const ticker = firstTicker(payload);
  if (!ticker) return null;
  return roundNumber(ticker.lastPrice || ticker.markPrice || ticker.indexPrice || ticker.bid1Price || ticker.ask1Price);
}

async function getAllOptionInstruments(config, warnings) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const payload = await capture(
      `BTC option instruments page ${page + 1}`,
      warnings,
      () => bybitPublicGet(config, '/v5/market/instruments-info', {
        category: 'option',
        baseCoin: 'BTC',
        limit: 1000,
        cursor
      }),
      null
    );
    if (!payload) break;
    rows.push(...resultList(payload));
    const nextCursor = payload.result && payload.result.nextPageCursor ? payload.result.nextPageCursor : null;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return rows;
}

function optionExpiry(symbol) {
  const parts = String(symbol || '').split('-');
  if (parts.length < 2) return null;
  const raw = parts[1];
  const match = raw.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) return raw;
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  return `20${match[3]}-${months[match[2]] || '01'}-${match[1].padStart(2, '0')}`;
}

function optionStrike(symbol) {
  const parts = String(symbol || '').split('-');
  return parts.length >= 3 ? roundNumber(parts[2]) : null;
}

function optionType(row) {
  if (row && row.optionsType) return row.optionsType;
  const side = String((row && row.symbol) || '').split('-')[3];
  if (side === 'C') return 'Call';
  if (side === 'P') return 'Put';
  return null;
}

function extractInstrumentSpec(row) {
  const lotSizeFilter = row && row.lotSizeFilter ? row.lotSizeFilter : {};
  const priceFilter = row && row.priceFilter ? row.priceFilter : {};
  const parsedExpiry = optionExpiry(row.symbol);
  return {
    symbol: row.symbol || null,
    expiry: parsedExpiry,
    deliveryTime: row.deliveryTime || null,
    strike: row.strike || optionStrike(row.symbol),
    optionType: optionType(row),
    status: row.status || null,
    baseCoin: row.baseCoin || null,
    quoteCoin: row.quoteCoin || null,
    settleCoin: row.settleCoin || null,
    minOrderQty: roundNumber(lotSizeFilter.minOrderQty),
    maxOrderQty: roundNumber(lotSizeFilter.maxOrderQty),
    qtyStep: roundNumber(lotSizeFilter.qtyStep),
    tickSize: roundNumber(priceFilter.tickSize),
    minPrice: roundNumber(priceFilter.minPrice),
    maxPrice: roundNumber(priceFilter.maxPrice),
    contractSize: roundNumber(row.contractSize || row.contractVal),
    lotSizeFilter,
    priceFilter,
    rawLimits: {
      deliveryTime: row.deliveryTime || null,
      launchTime: row.launchTime || null,
      displayName: row.displayName || null
    }
  };
}

function minNonNull(values) {
  const numbers = values.map(optionalNumber).filter(value => value !== null);
  return numbers.length ? Math.min(...numbers) : null;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))].sort();
}

function nextValidQty(targetQty, minOrderQty, qtyStep) {
  if (targetQty === null || minOrderQty === null || qtyStep === null || qtyStep <= 0) return null;
  if (targetQty <= minOrderQty) return roundNumber(minOrderQty);
  const steps = Math.ceil((targetQty - minOrderQty) / qtyStep - 1e-10);
  return roundNumber(minOrderQty + steps * qtyStep);
}

function isQtyCompatible(targetQty, minOrderQty, qtyStep) {
  const adjusted = nextValidQty(targetQty, minOrderQty, qtyStep);
  return adjusted === null ? 'unknown' : Math.abs(adjusted - targetQty) < 1e-8;
}

function buildScenario(underlyingQty, btcReferencePrice, minimums) {
  const approximateNotional = btcReferencePrice === null ? null : roundNumber(underlyingQty * btcReferencePrice, 2);
  const optionQty = nextValidQty(underlyingQty, minimums.minimumOptionQty, minimums.qtyStep);
  const theoreticalCapital = approximateNotional;
  const estimatedCapitalRequirement = theoreticalCapital === null
    ? null
    : roundNumber(theoreticalCapital * (1 + OPERATIONAL_BUFFER_RATE), 2);
  const capitalRemaining = estimatedCapitalRequirement === null
    ? null
    : roundNumber(LAB_CAPITAL_USDT - estimatedCapitalRequirement, 2);
  const qtyCompatible = isQtyCompatible(underlyingQty, minimums.minimumOptionQty, minimums.qtyStep);
  const feasible = estimatedCapitalRequirement !== null
    && capitalRemaining >= 0
    && qtyCompatible === true;
  const observations = [];

  if (qtyCompatible === false) {
    observations.push(`Underlying quantity is not exactly aligned to observable option minOrderQty/qtyStep; nearest valid option qty is ${optionQty}.`);
  }
  if (qtyCompatible === 'unknown') {
    observations.push('Option quantity compatibility is unknown because minimum quantity or step was unavailable.');
  }
  if (capitalRemaining !== null && capitalRemaining < 0) {
    observations.push('Estimated operational requirement exceeds the 2,000 USDT lab capital assumption.');
  }
  observations.push('Capital estimate uses underlying notional plus a simple 5% operational buffer only.');
  observations.push('Option margin, fees, spread, liquidity, settlement, and hidden venue checks are not validated.');

  return {
    underlyingQuantity: underlyingQty,
    approximateNotional,
    optionQuantity: optionQty,
    optionQuantityCompatible: qtyCompatible,
    theoreticalCapitalRequirement: theoreticalCapital,
    estimatedCapitalRequirement,
    capitalRemaining,
    labCapitalUsdt: LAB_CAPITAL_USDT,
    feasible: feasible ? 'YES' : 'NO',
    observations
  };
}

function buildMarkdown(analysis) {
  const lines = [];
  lines.push('# Execution Laboratory - Minimum Position Analysis');
  lines.push('');
  lines.push(`Generated at: ${analysis.metadata.generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Track B only.');
  lines.push('- Bybit Demo only.');
  lines.push('- Read-only GET calls only.');
  lines.push('- No orders, no fund adjustments, no Track A integration.');
  lines.push('');
  lines.push('## Observable Minimums');
  lines.push('');
  lines.push(`- BTC options found: ${analysis.summary.btcOptionsFound}`);
  lines.push(`- Minimum option qty: ${formatValue(analysis.summary.minimumOptionQty)}`);
  lines.push(`- Qty step: ${formatValue(analysis.summary.qtyStep)}`);
  lines.push(`- Tick size: ${formatValue(analysis.summary.tickSize)}`);
  lines.push(`- Minimum theoretical capital: ${formatUsd(analysis.summary.minimumTheoreticalCapital)}`);
  lines.push(`- Minimum operational capital: ${formatUsd(analysis.summary.minimumOperationalCapitalApprox)}`);
  lines.push('');
  lines.push('## Scenario Analysis');
  lines.push('');
  lines.push('| Underlying | Approx Notional | Option Qty | Est. Capital | Capital Remaining | Feasible |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- |');
  for (const scenario of analysis.scenarios) {
    lines.push(`| ${scenario.underlyingQuantity} BTC | ${formatUsd(scenario.approximateNotional)} | ${formatValue(scenario.optionQuantity)} | ${formatUsd(scenario.estimatedCapitalRequirement)} | ${formatUsd(scenario.capitalRemaining)} | ${scenario.feasible} |`);
  }
  lines.push('');
  lines.push('## Limitations');
  lines.push('');
  for (const limitation of analysis.limitations) {
    lines.push(`- ${limitation}`);
  }
  if (analysis.warnings.length) {
    lines.push('');
    lines.push('## API Warnings');
    lines.push('');
    for (const warning of analysis.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function formatValue(value) {
  return value === null || value === undefined ? 'unknown' : String(value);
}

function formatUsd(value) {
  return value === null || value === undefined ? 'unknown' : `${value} USDT`;
}

function timestampForMetadata(date = new Date()) {
  return date.toISOString();
}

function writeOutputs(instrumentSpecs, analysis) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const specsPath = path.join(OUTPUT_DIR, 'instrument_specs.json');
  const analysisJsonPath = path.join(OUTPUT_DIR, 'minimum_position_analysis.json');
  const analysisMdPath = path.join(OUTPUT_DIR, 'minimum_position_analysis.md');
  fs.writeFileSync(specsPath, `${JSON.stringify(instrumentSpecs, null, 2)}\n`, 'utf8');
  fs.writeFileSync(analysisJsonPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  fs.writeFileSync(analysisMdPath, buildMarkdown(analysis), 'utf8');
  return { specsPath, analysisJsonPath, analysisMdPath };
}

function printSummary(instrumentSpecs, analysis, paths) {
  console.log('Execution Laboratory');
  console.log('Instrument Specifications');
  console.log('');
  console.log(`BTC Options Found: ${instrumentSpecs.summary.count}`);
  console.log('');
  console.log(`Minimum Option Qty: ${formatValue(analysis.summary.minimumOptionQty)}`);
  console.log(`Qty Step: ${formatValue(analysis.summary.qtyStep)}`);
  console.log(`Tick Size: ${formatValue(analysis.summary.tickSize)}`);
  console.log('');
  console.log('Scenario Analysis');
  console.log('');
  for (const scenario of analysis.scenarios) {
    console.log(`${scenario.underlyingQuantity.toFixed(2)} BTC`);
    console.log(`Required Capital: ${formatUsd(scenario.estimatedCapitalRequirement)}`);
    console.log(`Feasible: ${scenario.feasible}`);
    console.log('');
  }
  if (analysis.warnings.length) {
    console.log(`Warnings: ${analysis.warnings.length}`);
    for (const warning of analysis.warnings) console.log(`- ${warning}`);
    console.log('');
  }
  console.log(`Instrument specs: ${paths.specsPath}`);
  console.log(`Analysis JSON: ${paths.analysisJsonPath}`);
  console.log(`Analysis MD: ${paths.analysisMdPath}`);
}

async function main() {
  const config = loadConfig();
  const configErrors = validateConfig(config);
  if (configErrors.length) {
    console.error('Execution Lab instrument specifications configuration error:');
    for (const error of configErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const warnings = [];
  const generatedAt = timestampForMetadata();
  const walletPayload = await bybitGet(config, '/v5/account/wallet-balance', {
    accountType: config.accountType
  });
  const wallet = walletCoins(walletPayload);
  const accountRaw = firstWalletAccount(walletPayload);
  const usdt = findCoin(wallet, 'USDT');
  const account = {
    usdtEquity: usdt ? usdt.equity : null,
    usdtWalletBalance: usdt ? usdt.walletBalance : null,
    totalAccountEquity: roundNumber(accountRaw.totalEquity),
    totalAvailableBalance: roundNumber(accountRaw.totalAvailableBalance)
  };

  const spotTicker = await capture(
    'BTC spot ticker',
    warnings,
    () => bybitPublicGet(config, '/v5/market/tickers', { category: 'spot', symbol: 'BTCUSDT' }),
    null
  );
  const linearTicker = await capture(
    'BTC perpetual ticker',
    warnings,
    () => bybitPublicGet(config, '/v5/market/tickers', { category: 'linear', symbol: 'BTCUSDT' }),
    null
  );
  const btcReferencePrice = tickerPrice(spotTicker) || tickerPrice(linearTicker);
  const optionRows = await getAllOptionInstruments(config, warnings);
  const optionSpecs = optionRows.map(extractInstrumentSpec);
  const activeOptionSpecs = optionSpecs.filter(row => !row.status || row.status === 'Trading');
  const specsForMinimums = activeOptionSpecs.length ? activeOptionSpecs : optionSpecs;

  const minimumOptionQty = minNonNull(specsForMinimums.map(row => row.minOrderQty));
  const qtyStep = minNonNull(specsForMinimums.map(row => row.qtyStep));
  const tickSize = minNonNull(specsForMinimums.map(row => row.tickSize));
  const minimumCoveredCallBtc = minimumOptionQty;
  const minimumTheoreticalCapital = btcReferencePrice === null || minimumCoveredCallBtc === null
    ? null
    : roundNumber(btcReferencePrice * minimumCoveredCallBtc, 2);
  const minimumOperationalCapitalApprox = minimumTheoreticalCapital === null
    ? null
    : roundNumber(minimumTheoreticalCapital * (1 + OPERATIONAL_BUFFER_RATE), 2);

  const minimums = {
    minimumOptionQty,
    qtyStep,
    tickSize,
    minimumCoveredCallBtc,
    minimumTheoreticalCapital,
    minimumOperationalCapitalApprox
  };
  const scenarios = SCENARIO_UNDERLYING_QTYS.map(qty => buildScenario(qty, btcReferencePrice, minimums));
  const limitations = [
    'Instrument metadata is observable exchange metadata only and does not prove order acceptance.',
    'Capital estimates use BTC notional plus a simple 5% operational buffer and do not model option margin.',
    'Fees, bid/ask spread, slippage, liquidity, exercise/settlement behavior, and hidden account constraints are not included.',
    'Covered-call feasibility assumes option quantity maps directly to BTC underlying quantity; this must be validated before any execution research.',
    'This script is non-production and sends no order or fund-adjustment requests.'
  ];

  const metadata = {
    track: 'Track B - Execution Laboratory',
    sprint: '0D.1',
    probe: 'bybit_instrument_specs',
    generatedAt,
    environment: config.environment,
    baseUrl: config.baseUrl,
    accountType: config.accountType,
    configSource: path.relative(REPO_ROOT, config.sourcePath),
    readOnly: true,
    getRequestsOnly: true,
    postRequestsSent: false,
    orderMutationEndpointsCalled: false,
    fundsMutationEndpointsCalled: false,
    trackAInteraction: false
  };

  const instrumentSpecs = {
    metadata,
    account,
    market: {
      btcReferencePrice,
      btcReferenceSource: tickerPrice(spotTicker) !== null ? 'spot_ticker_lastPrice' : 'linear_ticker_fallback'
    },
    summary: {
      count: optionSpecs.length,
      activeCount: activeOptionSpecs.length,
      expiries: uniqueSorted(optionSpecs.map(row => row.expiry)),
      statuses: uniqueSorted(optionSpecs.map(row => row.status)),
      baseCoins: uniqueSorted(optionSpecs.map(row => row.baseCoin)),
      quoteCoins: uniqueSorted(optionSpecs.map(row => row.quoteCoin)),
      settleCoins: uniqueSorted(optionSpecs.map(row => row.settleCoin)),
      minimumOptionQty,
      qtyStep,
      tickSize,
      minPrice: minNonNull(specsForMinimums.map(row => row.minPrice)),
      maxPrice: minNonNull(specsForMinimums.map(row => row.maxPrice))
    },
    instruments: optionSpecs,
    warnings
  };

  const analysis = {
    metadata,
    summary: {
      btcOptionsFound: optionSpecs.length,
      activeBtcOptionsFound: activeOptionSpecs.length,
      btcReferencePrice,
      labCapitalUsdt: LAB_CAPITAL_USDT,
      operationalBufferRate: OPERATIONAL_BUFFER_RATE,
      ...minimums
    },
    scenarios,
    limitations,
    warnings
  };

  const paths = writeOutputs(instrumentSpecs, analysis);
  printSummary(instrumentSpecs, analysis, paths);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab instrument specifications failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
