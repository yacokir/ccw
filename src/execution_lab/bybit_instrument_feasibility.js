const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const LAB_DIR = __dirname;
const REPO_ROOT = path.resolve(LAB_DIR, '..', '..');
const LOCAL_CONFIG_PATH = path.join(LAB_DIR, 'execution_lab_config.json');
const EXAMPLE_CONFIG_PATH = path.join(LAB_DIR, 'execution_lab_config.example.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated', 'execution_lab');
const DEMO_BASE_URL = 'https://api-demo.bybit.com';
const TARGET_UNDERLYING_QTY = 0.01;
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

function roundNumber(value) {
  const number = optionalNumber(value);
  return number === null ? null : Math.round(number * 100000000) / 100000000;
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
    usdValue: roundNumber(coin.usdValue)
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

function firstInstrument(payload) {
  return resultList(payload)[0] || null;
}

function extractLotSize(row) {
  return row && row.lotSizeFilter ? row.lotSizeFilter : {};
}

function extractPriceFilter(row) {
  return row && row.priceFilter ? row.priceFilter : {};
}

function spotConstraints(row) {
  const lot = extractLotSize(row);
  const price = extractPriceFilter(row);
  return {
    symbol: row ? row.symbol || null : null,
    minOrderQty: roundNumber(lot.minOrderQty),
    qtyStep: roundNumber(lot.qtyStep),
    tickSize: roundNumber(price.tickSize),
    minNotionalValue: roundNumber(lot.minNotionalValue)
  };
}

function perpetualConstraints(row) {
  const lot = extractLotSize(row);
  const price = extractPriceFilter(row);
  return {
    symbol: row ? row.symbol || null : null,
    minOrderQty: roundNumber(lot.minOrderQty),
    qtyStep: roundNumber(lot.qtyStep),
    tickSize: roundNumber(price.tickSize),
    leverageFilter: row && row.leverageFilter ? row.leverageFilter : null
  };
}

function optionConstraints(rows) {
  const sample = rows[0] || null;
  const lot = extractLotSize(sample);
  const price = extractPriceFilter(sample);
  return {
    contractSize: roundNumber(sample && (sample.contractSize || sample.contractVal)),
    minOrderQty: roundNumber(lot.minOrderQty),
    qtyStep: roundNumber(lot.qtyStep),
    tickSize: roundNumber(price.tickSize),
    settlementAsset: sample ? sample.settleCoin || sample.quoteCoin || null : null,
    supportedExpiries: supportedExpiries(rows)
  };
}

function supportedExpiries(rows) {
  return [...new Set((rows || [])
    .map(row => optionExpiry(row.symbol))
    .filter(Boolean))]
    .sort();
}

function optionExpiry(symbol) {
  const parts = String(symbol || '').split('-');
  if (parts.length < 2) return null;
  const raw = parts[1];
  const match = raw.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!match) return raw;
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  return `20${match[3]}-${months[match[2]] || '01'}-${match[1]}`;
}

function nearestWeeklyCandidate(rows) {
  const calls = (rows || [])
    .filter(row => row && row.symbol && String(row.symbol).includes('-C'))
    .map(row => ({
      symbol: row.symbol,
      expiry: optionExpiry(row.symbol),
      strike: optionStrike(row.symbol),
      settleCoin: row.settleCoin || row.quoteCoin || null,
      status: row.status || null,
      lotSizeFilter: row.lotSizeFilter || null,
      priceFilter: row.priceFilter || null
    }))
    .filter(row => row.expiry)
    .sort((a, b) => a.expiry.localeCompare(b.expiry) || (a.strike || 0) - (b.strike || 0));
  return calls[0] || null;
}

function optionStrike(symbol) {
  const parts = String(symbol || '').split('-');
  return parts.length >= 3 ? roundNumber(parts[2]) : null;
}

function quantityCompatible(targetQty, minOrderQty, qtyStep) {
  if (targetQty === null || minOrderQty === null || qtyStep === null || qtyStep <= 0) return 'unknown';
  if (targetQty < minOrderQty) return false;
  const steps = Math.round((targetQty - minOrderQty) / qtyStep);
  const reconstructed = roundNumber(minOrderQty + steps * qtyStep);
  return Math.abs(reconstructed - targetQty) < 1e-8;
}

function spotFeasible(targetQty, constraints) {
  return quantityCompatible(targetQty, constraints.minOrderQty, constraints.qtyStep);
}

function optionFeasible(targetQty, constraints, available) {
  if (!available) return false;
  return quantityCompatible(targetQty, constraints.minOrderQty, constraints.qtyStep);
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${timestampForFile()}_instrument_feasibility.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function printConstraintLine(label, constraints) {
  console.log(`${label}: ${constraints.symbol || 'unknown'} minQty=${constraints.minOrderQty === null ? 'unknown' : constraints.minOrderQty} qtyStep=${constraints.qtyStep === null ? 'unknown' : constraints.qtyStep} tickSize=${constraints.tickSize === null ? 'unknown' : constraints.tickSize}`);
}

function printSummary(snapshot, outputPath) {
  console.log('Execution Laboratory Instrument Feasibility');
  console.log(`USDT equity: ${snapshot.account.accountEquity === null ? 'unknown' : snapshot.account.accountEquity}`);
  console.log(`BTC reference price: ${snapshot.market.btcReferencePrice === null ? 'unknown' : snapshot.market.btcReferencePrice}`);
  console.log('');
  console.log('Spot:');
  printConstraintLine('BTC spot', snapshot.spot.observableConstraints);
  console.log('Perpetual:');
  printConstraintLine('BTC perpetual', snapshot.perpetual.observableConstraints);
  console.log('Options:');
  console.log(`available=${snapshot.options.optionAvailability} nearest=${snapshot.options.nearestWeeklyCandidate ? snapshot.options.nearestWeeklyCandidate.symbol : 'none'} minQty=${snapshot.options.observableConstraints.minOrderQty === null ? 'unknown' : snapshot.options.observableConstraints.minOrderQty} qtyStep=${snapshot.options.observableConstraints.qtyStep === null ? 'unknown' : snapshot.options.observableConstraints.qtyStep}`);
  console.log('');
  console.log(`Minimum underlying appears feasible: ${snapshot.research.minimumUnderlyingQtyAppearsFeasible}`);
  console.log(`Minimum option appears feasible: ${snapshot.research.minimumOptionQtyAppearsFeasible}`);
  console.log(`Minimum covered call appears feasible: ${snapshot.research.minimumCoveredCallAppearsFeasible}`);
  console.log('Research conclusions: preliminary only.');
  if (snapshot.warnings.length) {
    console.log(`Warnings: ${snapshot.warnings.length}`);
    for (const warning of snapshot.warnings) console.log(`- ${warning}`);
  }
  console.log(`Snapshot: ${outputPath}`);
}

async function main() {
  const config = loadConfig();
  const configErrors = validateConfig(config);
  if (configErrors.length) {
    console.error('Execution Lab instrument feasibility configuration error:');
    for (const error of configErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const warnings = [];
  const generatedAt = new Date().toISOString();
  const walletPayload = await bybitGet(config, '/v5/account/wallet-balance', {
    accountType: config.accountType
  });
  const wallet = walletCoins(walletPayload);
  const accountRaw = firstWalletAccount(walletPayload);
  const usdt = findCoin(wallet, 'USDT');

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
  const spotInstrumentPayload = await capture(
    'BTC spot instrument',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', { category: 'spot', symbol: 'BTCUSDT' }),
    null
  );
  const linearInstrumentPayload = await capture(
    'BTC perpetual instrument',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', { category: 'linear', symbol: 'BTCUSDT' }),
    null
  );
  const optionInstrumentPayload = await capture(
    'BTC option instruments',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', { category: 'option', baseCoin: 'BTC', limit: 200 }),
    null
  );

  const spot = spotConstraints(firstInstrument(spotInstrumentPayload));
  const perpetual = perpetualConstraints(firstInstrument(linearInstrumentPayload));
  const optionRows = resultList(optionInstrumentPayload);
  const options = optionConstraints(optionRows);
  const optionAvailability = optionRows.length > 0;
  const underlyingFeasible = spotFeasible(TARGET_UNDERLYING_QTY, spot);
  const optionQtyFeasible = optionFeasible(TARGET_UNDERLYING_QTY, options, optionAvailability);
  const coveredCallFeasible = underlyingFeasible === true && optionQtyFeasible === true
    ? true
    : underlyingFeasible === false || optionQtyFeasible === false
      ? false
      : 'unknown';

  const snapshot = {
    metadata: {
      track: 'Track B - Execution Laboratory',
      probe: 'bybit_instrument_feasibility',
      generatedAt,
      environment: config.environment,
      baseUrl: config.baseUrl,
      accountType: config.accountType,
      configSource: path.relative(REPO_ROOT, config.sourcePath),
      readOnly: true,
      postRequestsSent: false,
      orderMutationEndpointsCalled: false,
      trackAInteraction: false
    },
    account: {
      accountEquity: usdt ? usdt.equity : roundNumber(accountRaw.totalEquity),
      availableBalance: usdt ? usdt.walletBalance : roundNumber(accountRaw.totalAvailableBalance),
      totalAccountEquity: roundNumber(accountRaw.totalEquity),
      totalAvailableBalance: roundNumber(accountRaw.totalAvailableBalance)
    },
    market: {
      btcReferencePrice: tickerPrice(spotTicker) || tickerPrice(linearTicker),
      btcReferenceSource: tickerPrice(spotTicker) !== null ? 'spot_ticker_lastPrice' : 'linear_ticker_fallback',
      underlyingQtyTarget: TARGET_UNDERLYING_QTY
    },
    spot: {
      observableConstraints: spot
    },
    perpetual: {
      observableConstraints: perpetual
    },
    options: {
      observableConstraints: options,
      nearestWeeklyCandidate: nearestWeeklyCandidate(optionRows),
      optionAvailability
    },
    research: {
      minimumUnderlyingQtyAppearsFeasible: underlyingFeasible,
      minimumOptionQtyAppearsFeasible: optionQtyFeasible,
      minimumCoveredCallAppearsFeasible: coveredCallFeasible,
      requiredUnderlyingQty: TARGET_UNDERLYING_QTY,
      requiredOptionQty: TARGET_UNDERLYING_QTY,
      conclusions: 'preliminary only'
    },
    warnings
  };

  const outputPath = writeSnapshot(snapshot);
  printSummary(snapshot, outputPath);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab instrument feasibility failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
