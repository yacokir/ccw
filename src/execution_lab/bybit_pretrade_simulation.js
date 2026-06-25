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
  accountType: 'UNIFIED',
  openOrderLimit: 50
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
    errors.push('Execution Lab Sprint 0D only allows environment="demo".');
  }
  if (config.baseUrl !== DEMO_BASE_URL) {
    errors.push(`Execution Lab Sprint 0D only allows baseUrl=${DEMO_BASE_URL}.`);
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
    usdValue: roundNumber(coin.usdValue),
    collateralSwitch: coin.collateralSwitch !== undefined ? coin.collateralSwitch : null,
    marginCollateral: coin.marginCollateral !== undefined ? coin.marginCollateral : null
  })));
}

function findCoin(wallet, coin) {
  return (wallet || []).find(row => row.coin === coin) || null;
}

function nonZeroPositions(payload, category) {
  return resultList(payload)
    .filter(position => optionalNumber(position.size) !== null && optionalNumber(position.size) !== 0)
    .map(position => ({
      category,
      symbol: position.symbol || null,
      side: position.side || null,
      size: roundNumber(position.size),
      positionValue: roundNumber(position.positionValue),
      avgPrice: roundNumber(position.avgPrice),
      markPrice: roundNumber(position.markPrice)
    }));
}

function compactOrders(payload, category) {
  return resultList(payload).map(order => ({
    category,
    symbol: order.symbol || null,
    orderId: order.orderId || null,
    side: order.side || null,
    orderType: order.orderType || null,
    orderStatus: order.orderStatus || null,
    qty: roundNumber(order.qty),
    price: roundNumber(order.price)
  }));
}

function openOrderParamsForCategory(category, limit) {
  if (category === 'linear') return { category, settleCoin: 'USDT', limit };
  if (category === 'option') return { category, settleCoin: 'USDT', limit };
  if (category === 'spot') return { category, limit };
  return null;
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

function summarizeInstrument(row) {
  if (!row) return null;
  return {
    symbol: row.symbol || null,
    status: row.status || null,
    baseCoin: row.baseCoin || null,
    quoteCoin: row.quoteCoin || null,
    settleCoin: row.settleCoin || null,
    lotSizeFilter: row.lotSizeFilter || null,
    priceFilter: row.priceFilter || null,
    contractType: row.contractType || null,
    optionsType: row.optionsType || null,
    launchTime: row.launchTime || null,
    deliveryTime: row.deliveryTime || null
  };
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${timestampForFile()}_pretrade_simulation.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function buildAccount(walletPayload, wallet, positions, openOrders) {
  const account = firstWalletAccount(walletPayload);
  const usdt = findCoin(wallet, 'USDT');
  return {
    accountEquity: roundNumber(account.totalEquity),
    availableBalance: usdt ? usdt.walletBalance : null,
    usdtEquity: usdt ? usdt.equity : null,
    usdtWalletBalance: usdt ? usdt.walletBalance : null,
    totalAvailableBalance: roundNumber(account.totalAvailableBalance),
    marginBalance: roundNumber(account.totalMarginBalance),
    positionsCount: positions.length,
    openOrdersCount: openOrders.length
  };
}

function capabilityFromAvailable(available, required) {
  if (available === null || required === null) return 'unknown';
  return available >= required;
}

function printSummary(snapshot, outputPath) {
  console.log('Execution Laboratory Pre-Trade Simulation');
  console.log(`USDT equity: ${snapshot.account.usdtEquity === null ? 'unknown' : snapshot.account.usdtEquity}`);
  console.log(`BTC reference price: ${snapshot.simulation.btcReferencePrice === null ? 'unknown' : snapshot.simulation.btcReferencePrice}`);
  console.log(`Underlying quantity: ${snapshot.simulation.targetUnderlyingQty} BTC`);
  console.log(`Underlying notional: ${snapshot.simulation.underlyingNotional === null ? 'unknown' : snapshot.simulation.underlyingNotional}`);
  console.log(`Estimated 30% hedge notional: ${snapshot.simulation.estimatedHedge30Notional === null ? 'unknown' : snapshot.simulation.estimatedHedge30Notional}`);
  console.log(`Estimated 40% hedge notional: ${snapshot.simulation.estimatedHedge40Notional === null ? 'unknown' : snapshot.simulation.estimatedHedge40Notional}`);
  console.log('Research conclusions: preliminary only');
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
    console.error('Execution Lab pre-trade simulation configuration error:');
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

  const spotTicker = await capture(
    'BTC spot ticker',
    warnings,
    () => bybitPublicGet(config, '/v5/market/tickers', { category: 'spot', symbol: 'BTCUSDT' }),
    null
  );
  const linearTicker = await capture(
    'BTC linear ticker',
    warnings,
    () => bybitPublicGet(config, '/v5/market/tickers', { category: 'linear', symbol: 'BTCUSDT' }),
    null
  );
  const spotInstrument = await capture(
    'BTC spot instrument',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', { category: 'spot', symbol: 'BTCUSDT' }),
    null
  );
  const linearInstrument = await capture(
    'BTC linear instrument',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', { category: 'linear', symbol: 'BTCUSDT' }),
    null
  );
  const optionInstruments = await capture(
    'BTC option instruments',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', { category: 'option', baseCoin: 'BTC', limit: 5 }),
    null
  );

  const positions = [];
  for (const category of ['linear', 'option']) {
    const payload = await capture(
      `${category} positions`,
      warnings,
      () => bybitGet(config, '/v5/position/list', { category, settleCoin: 'USDT' }),
      null
    );
    positions.push(...nonZeroPositions(payload, category));
  }

  const openOrders = [];
  for (const category of ['spot', 'linear', 'option']) {
    const params = openOrderParamsForCategory(category, config.openOrderLimit);
    const payload = await capture(
      `${category} open orders`,
      warnings,
      () => bybitGet(config, '/v5/order/realtime', params),
      null
    );
    openOrders.push(...compactOrders(payload, category));
  }

  const account = buildAccount(walletPayload, wallet, positions, openOrders);
  const btcReferencePrice = tickerPrice(spotTicker) || tickerPrice(linearTicker);
  const underlyingNotional = btcReferencePrice === null ? null : roundNumber(TARGET_UNDERLYING_QTY * btcReferencePrice);
  const estimatedHedge30Notional = underlyingNotional === null ? null : roundNumber(underlyingNotional * 0.3);
  const estimatedHedge40Notional = underlyingNotional === null ? null : roundNumber(underlyingNotional * 0.4);
  const estimatedCapitalConsumed = underlyingNotional;
  const estimatedCapitalRemaining = account.availableBalance === null || estimatedCapitalConsumed === null
    ? null
    : roundNumber(account.availableBalance - estimatedCapitalConsumed);

  const snapshot = {
    metadata: {
      track: 'Track B - Execution Laboratory',
      probe: 'bybit_pretrade_simulation',
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
    account,
    simulation: {
      targetUnderlyingQty: TARGET_UNDERLYING_QTY,
      btcReferencePrice,
      btcReferenceSource: tickerPrice(spotTicker) !== null ? 'spot_ticker_lastPrice' : 'linear_ticker_fallback',
      underlyingNotional,
      estimatedCapitalConsumed,
      estimatedCapitalRemaining,
      estimatedCoveredCallContracts: TARGET_UNDERLYING_QTY,
      estimatedHedge30Notional,
      estimatedHedge40Notional
    },
    research: {
      appearsCapableOfOpeningUnderlying: capabilityFromAvailable(account.availableBalance, underlyingNotional),
      appearsCapableOfSupportingCoveredCall: 'unknown',
      appearsCapableOfSupporting30PctHedge: 'unknown',
      appearsCapableOfSupporting40PctHedge: 'unknown',
      notes: [
        'Opening-underlying capability is based only on observed USDT wallet balance versus spot notional.',
        'Covered-call and hedge support remain unknown because this script does not model option margin, hedge margin, liquidity, or execution assumptions.'
      ]
    },
    market: {
      spotTicker: firstTicker(spotTicker),
      linearTicker: firstTicker(linearTicker),
      spotInstrument: summarizeInstrument(firstInstrument(spotInstrument)),
      linearInstrument: summarizeInstrument(firstInstrument(linearInstrument)),
      optionInstrumentSample: resultList(optionInstruments).slice(0, 5).map(summarizeInstrument)
    },
    wallet,
    positions,
    openOrders,
    warnings
  };

  const outputPath = writeSnapshot(snapshot);
  printSummary(snapshot, outputPath);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab pre-trade simulation failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
