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
const TARGET_OPTION_QTY = 0.01;
const TARGET_BUY_QTY = 0.011;
const OTM_RATE = 0.05;
const DEFAULT_CONFIG = {
  environment: 'demo',
  baseUrl: DEMO_BASE_URL,
  apiKey: '',
  apiSecret: '',
  recvWindow: 5000,
  accountType: 'UNIFIED',
  openOrderLimit: 50,
  recentFillLimit: 20
};

function parseArgs(argv) {
  return {
    execute: argv.includes('--execute'),
    diagnoseExistingReport: argv.includes('--diagnose-existing-report'),
    sellExistingCallOnly: argv.includes('--sell-existing-call-only')
  };
}

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
    errors.push('Execution Lab Sprint 0E only allows environment="demo".');
  }
  if (config.baseUrl !== DEMO_BASE_URL) {
    errors.push(`Execution Lab Sprint 0E only allows baseUrl=${DEMO_BASE_URL}.`);
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

function signRequest(config, timestamp, payload) {
  const raw = `${timestamp}${config.apiKey}${config.recvWindow}${payload}`;
  return crypto
    .createHmac('sha256', config.apiSecret)
    .update(raw)
    .digest('hex');
}

function requestJson(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        responseBody += chunk;
      });
      response.on('end', () => {
        let payload = null;
        try {
          payload = responseBody ? JSON.parse(responseBody) : null;
        } catch (error) {
          reject(new Error(`Invalid JSON from ${method} ${url}: ${error.message}`));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`HTTP ${response.statusCode} from ${method} ${url}: ${responseBody.slice(0, 500)}`);
          error.payload = payload;
          reject(error);
          return;
        }
        if (payload && payload.retCode !== 0) {
          const error = new Error(`Bybit retCode ${payload.retCode} from ${method} ${url}: ${payload.retMsg || 'unknown error'}`);
          error.payload = payload;
          reject(error);
          return;
        }
        resolve(payload);
      });
    });
    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timeout from ${method} ${url}`));
    });
    request.on('error', reject);
    if (body !== null) request.write(body);
    request.end();
  });
}

function bybitGet(config, pathname, params = {}) {
  const query = queryString(params);
  const timestamp = String(Date.now());
  const signature = signRequest(config, timestamp, query);
  const url = `${config.baseUrl}${pathname}${query ? `?${query}` : ''}`;
  return requestJson(url, 'GET', {
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
  return requestJson(url, 'GET');
}

function bybitPost(config, pathname, bodyObject) {
  const body = JSON.stringify(bodyObject);
  const timestamp = String(Date.now());
  const signature = signRequest(config, timestamp, body);
  const url = `${config.baseUrl}${pathname}`;
  return requestJson(url, 'POST', {
    'Content-Type': 'application/json',
    'X-BAPI-API-KEY': config.apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-TYPE': '2',
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': config.recvWindow
  }, body);
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

function roundUpNumber(value, decimals = 8) {
  const number = optionalNumber(value);
  if (number === null) return null;
  const multiplier = 10 ** decimals;
  return Math.ceil(number * multiplier) / multiplier;
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
    free: roundNumber(coin.free),
    locked: roundNumber(coin.locked),
    availableToWithdraw: roundNumber(coin.availableToWithdraw),
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
      avgPrice: roundNumber(position.avgPrice),
      markPrice: roundNumber(position.markPrice),
      positionValue: roundNumber(position.positionValue),
      unrealisedPnl: roundNumber(position.unrealisedPnl),
      positionIM: roundNumber(position.positionIM),
      positionMM: roundNumber(position.positionMM)
    }));
}

function compactOrders(payload, category) {
  return resultList(payload).map(order => ({
    category,
    symbol: order.symbol || null,
    orderId: order.orderId || null,
    orderLinkId: order.orderLinkId || null,
    side: order.side || null,
    orderType: order.orderType || null,
    orderStatus: order.orderStatus || null,
    qty: roundNumber(order.qty),
    price: roundNumber(order.price),
    avgPrice: roundNumber(order.avgPrice),
    cumExecQty: roundNumber(order.cumExecQty),
    cumExecValue: roundNumber(order.cumExecValue),
    createdTime: order.createdTime || null,
    updatedTime: order.updatedTime || null
  }));
}

function compactFills(payload, category) {
  return resultList(payload).map(fill => ({
    category,
    symbol: fill.symbol || null,
    execId: fill.execId || null,
    orderId: fill.orderId || null,
    orderLinkId: fill.orderLinkId || null,
    side: fill.side || null,
    execPrice: roundNumber(fill.execPrice),
    execQty: roundNumber(fill.execQty),
    execValue: roundNumber(fill.execValue),
    execFee: roundNumber(fill.execFee),
    execFeeV2: roundNumber(fill.execFeeV2),
    feeRate: roundNumber(fill.feeRate),
    feeCurrency: fill.feeCurrency || null,
    orderQty: roundNumber(fill.orderQty),
    marketUnit: fill.marketUnit || null,
    isMaker: fill.isMaker !== undefined ? fill.isMaker : null,
    execTime: fill.execTime || null
  }));
}

function firstTicker(payload) {
  return resultList(payload)[0] || null;
}

function tickerPrice(payload) {
  const ticker = firstTicker(payload);
  if (!ticker) return null;
  return roundNumber(ticker.lastPrice || ticker.markPrice || ticker.indexPrice || ticker.bid1Price || ticker.ask1Price);
}

function openOrderParamsForCategory(category, limit) {
  if (category === 'linear') return { category, settleCoin: 'USDT', limit };
  if (category === 'option') return { category, baseCoin: 'BTC', limit };
  if (category === 'spot') return { category, limit };
  return null;
}

async function captureAccountSnapshot(config, label, warnings) {
  const walletPayload = await bybitGet(config, '/v5/account/wallet-balance', {
    accountType: config.accountType
  });
  const wallet = walletCoins(walletPayload);
  const accountRaw = firstWalletAccount(walletPayload);
  const positions = [];
  const openOrders = [];

  for (const category of ['linear', 'option']) {
    const params = category === 'option'
      ? { category, baseCoin: 'BTC' }
      : { category, settleCoin: 'USDT' };
    const payload = await capture(
      `${label} ${category} positions`,
      warnings,
      () => bybitGet(config, '/v5/position/list', params),
      null
    );
    positions.push(...nonZeroPositions(payload, category));
  }

  for (const category of ['spot', 'linear', 'option']) {
    const params = openOrderParamsForCategory(category, config.openOrderLimit);
    const payload = await capture(
      `${label} ${category} open orders`,
      warnings,
      () => bybitGet(config, '/v5/order/realtime', params),
      null
    );
    openOrders.push(...compactOrders(payload, category));
  }

  const usdt = findCoin(wallet, 'USDT');
  const btc = findCoin(wallet, 'BTC');
  return {
    label,
    capturedAt: new Date().toISOString(),
    account: {
      accountEquity: roundNumber(accountRaw.totalEquity),
      totalWalletBalance: roundNumber(accountRaw.totalWalletBalance),
      availableBalance: roundNumber(accountRaw.totalAvailableBalance),
      marginBalance: roundNumber(accountRaw.totalMarginBalance),
      initialMargin: roundNumber(accountRaw.totalInitialMargin),
      maintenanceMargin: roundNumber(accountRaw.totalMaintenanceMargin),
      marginUtilization: marginUtilization(accountRaw),
      usdtEquity: usdt ? usdt.equity : null,
      usdtWalletBalance: usdt ? usdt.walletBalance : null,
      btcEquity: btc ? btc.equity : null,
      btcWalletBalance: btc ? btc.walletBalance : null,
      positionsCount: positions.length,
      openOrdersCount: openOrders.length
    },
    wallet,
    positions,
    openOrders
  };
}

function marginUtilization(accountRaw) {
  const equity = optionalNumber(accountRaw.totalEquity);
  const initialMargin = optionalNumber(accountRaw.totalInitialMargin);
  if (equity === null || equity === 0 || initialMargin === null) return null;
  return roundNumber(initialMargin / equity, 8);
}

function nextFriday(date = new Date()) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const daysAhead = (5 - day + 7) % 7 || 7;
  result.setUTCDate(result.getUTCDate() + daysAhead);
  return result;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
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

function summarizeOption(row) {
  const lotSizeFilter = row && row.lotSizeFilter ? row.lotSizeFilter : {};
  const priceFilter = row && row.priceFilter ? row.priceFilter : {};
  return {
    symbol: row.symbol || null,
    expiry: optionExpiry(row.symbol),
    strike: optionStrike(row.symbol),
    optionType: optionType(row),
    status: row.status || null,
    baseCoin: row.baseCoin || null,
    quoteCoin: row.quoteCoin || null,
    settleCoin: row.settleCoin || null,
    minOrderQty: roundNumber(lotSizeFilter.minOrderQty),
    qtyStep: roundNumber(lotSizeFilter.qtyStep),
    tickSize: roundNumber(priceFilter.tickSize),
    minPrice: roundNumber(priceFilter.minPrice),
    maxPrice: roundNumber(priceFilter.maxPrice),
    lotSizeFilter,
    priceFilter
  };
}

async function selectWeeklyOtmCall(config, btcReferencePrice, warnings) {
  const targetExpiry = formatDate(nextFriday());
  const targetStrike = btcReferencePrice === null ? null : roundNumber(btcReferencePrice * (1 + OTM_RATE), 2);
  const payload = await capture(
    'BTC option instruments',
    warnings,
    () => bybitPublicGet(config, '/v5/market/instruments-info', {
      category: 'option',
      baseCoin: 'BTC',
      limit: 1000
    }),
    null
  );
  const rows = resultList(payload).map(summarizeOption);
  const candidates = rows
    .filter(row => row.status === 'Trading')
    .filter(row => row.optionType === 'Call')
    .filter(row => row.expiry === targetExpiry);
  const selected = candidates
    .filter(row => targetStrike === null || row.strike >= targetStrike)
    .sort((a, b) => Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike))[0]
    || candidates
      .sort((a, b) => Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike))[0]
    || null;

  return {
    targetExpiry,
    targetStrike,
    optionsFound: rows.length,
    candidatesFound: candidates.length,
    selected,
    fallbackUsed: selected ? selected.strike < targetStrike : false
  };
}

function orderLinkId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

async function placeMarketOrder(config, request) {
  const response = await bybitPost(config, '/v5/order/create', request);
  return {
    requestedAt: new Date().toISOString(),
    request,
    response,
    orderId: response && response.result ? response.result.orderId || null : null,
    orderLinkId: response && response.result ? response.result.orderLinkId || request.orderLinkId || null : request.orderLinkId || null
  };
}

async function recentFills(config, category, orderId, warnings, symbol = null) {
  const params = {
    category,
    orderId,
    limit: DEFAULT_CONFIG.recentFillLimit
  };
  if (symbol) params.symbol = symbol;
  const payload = await capture(
    `${category} fills for ${orderId || 'latest order'}`,
    warnings,
    () => bybitGet(config, '/v5/execution/list', params),
    null
  );
  return compactFills(payload, category);
}

async function orderHistory(config, category, orderId, warnings, symbol = null) {
  const params = {
    category,
    orderId,
    limit: DEFAULT_CONFIG.recentFillLimit
  };
  if (symbol) params.symbol = symbol;
  const payload = await capture(
    `${category} order history for ${orderId || 'latest order'}`,
    warnings,
    () => bybitGet(config, '/v5/order/history', params),
    null
  );
  return resultList(payload);
}

function sumFills(fills) {
  const execQty = roundNumber((fills || []).reduce((sum, fill) => sum + (optionalNumber(fill.execQty) || 0), 0));
  const execValue = roundNumber((fills || []).reduce((sum, fill) => sum + (optionalNumber(fill.execValue) || 0), 0));
  const feesByCurrency = {};
  for (const fill of fills || []) {
    const currency = fill.feeCurrency || 'UNKNOWN';
    feesByCurrency[currency] = roundNumber((feesByCurrency[currency] || 0) + (optionalNumber(fill.execFee) || 0));
  }
  const fees = roundNumber((fills || []).reduce((sum, fill) => sum + (optionalNumber(fill.execFee) || 0), 0));
  const avgPrice = execQty && execValue ? roundNumber(execValue / execQty) : null;
  return { execQty, execValue, avgPrice, fees, feesByCurrency };
}

function btcNetReceivedFromExecution(fillSummary, btcWalletBalanceDelta) {
  if (optionalNumber(btcWalletBalanceDelta) !== null) return btcWalletBalanceDelta;
  const btcFee = fillSummary.feesByCurrency ? optionalNumber(fillSummary.feesByCurrency.BTC) || 0 : 0;
  if (optionalNumber(fillSummary.execQty) === null) return null;
  return roundNumber(fillSummary.execQty - btcFee);
}

function coverageSufficient(btcNetReceived) {
  return optionalNumber(btcNetReceived) !== null && btcNetReceived >= TARGET_OPTION_QTY;
}

function applyUnderlyingExecutionAnalysis(underlyingPurchase, initialSnapshot = null, afterUnderlyingSnapshot = null) {
  if (underlyingPurchase.requestedQty === null || underlyingPurchase.requestedQty === undefined) {
    underlyingPurchase.requestedQty = roundNumber(underlyingPurchase.request && underlyingPurchase.request.qty);
  }
  const btcBefore = initialSnapshot ? optionalNumber(initialSnapshot.account.btcWalletBalance) || 0 : optionalNumber(underlyingPurchase.observedBtcWalletBalanceBefore) || 0;
  const btcAfter = afterUnderlyingSnapshot ? optionalNumber(afterUnderlyingSnapshot.account.btcWalletBalance) : optionalNumber(underlyingPurchase.btcWalletBalanceAfter);
  const usdtBefore = initialSnapshot ? optionalNumber(initialSnapshot.account.usdtWalletBalance) : optionalNumber(underlyingPurchase.usdtWalletBalanceBefore);
  const usdtAfter = afterUnderlyingSnapshot ? optionalNumber(afterUnderlyingSnapshot.account.usdtWalletBalance) : optionalNumber(underlyingPurchase.usdtWalletBalanceAfter);
  underlyingPurchase.btcWalletBalanceBefore = btcBefore;
  underlyingPurchase.btcWalletBalanceAfter = btcAfter;
  underlyingPurchase.btcWalletBalanceDelta = btcAfter === null ? underlyingPurchase.btcWalletBalanceDelta : roundNumber(btcAfter - btcBefore);
  underlyingPurchase.usdtWalletBalanceBefore = usdtBefore;
  underlyingPurchase.usdtWalletBalanceAfter = usdtAfter;
  underlyingPurchase.usdtWalletBalanceDelta = usdtBefore === null || usdtAfter === null ? null : roundNumber(usdtAfter - usdtBefore);

  const fillSummary = sumFills(underlyingPurchase.fills);
  underlyingPurchase.fillSummary = fillSummary;
  underlyingPurchase.executedQty = fillSummary.execQty;
  underlyingPurchase.averagePrice = fillSummary.avgPrice;
  underlyingPurchase.executionValue = fillSummary.execValue;
  underlyingPurchase.fees = fillSummary.feesByCurrency;
  underlyingPurchase.btcNetReceived = btcNetReceivedFromExecution(fillSummary, underlyingPurchase.btcWalletBalanceDelta);
  underlyingPurchase.orderSubmitted = Boolean(
    underlyingPurchase.orderId
    || (underlyingPurchase.response && underlyingPurchase.response.retCode === 0 && underlyingPurchase.response.result && underlyingPurchase.response.result.orderId)
  );
  underlyingPurchase.orderFilled = fillSummary.execQty > 0
    || (underlyingPurchase.orderHistory || []).some(order => order.orderStatus === 'Filled');
  underlyingPurchase.btcBalanceIncreased = optionalNumber(underlyingPurchase.btcWalletBalanceDelta) !== null
    && underlyingPurchase.btcWalletBalanceDelta > 0;
  underlyingPurchase.usdtBalanceDecreased = optionalNumber(underlyingPurchase.usdtWalletBalanceDelta) !== null
    && underlyingPurchase.usdtWalletBalanceDelta < 0;
  underlyingPurchase.executionSuccess = underlyingPurchase.orderSubmitted && (
    underlyingPurchase.orderFilled
    || (underlyingPurchase.btcBalanceIncreased && underlyingPurchase.usdtBalanceDecreased)
  );
  underlyingPurchase.coverageSufficient = coverageSufficient(underlyingPurchase.btcNetReceived);
  if (underlyingPurchase.executionSuccess && underlyingPurchase.coverageSufficient) {
    underlyingPurchase.status = 'EXECUTION_SUCCESS_COVERAGE_SUFFICIENT';
  } else if (underlyingPurchase.executionSuccess) {
    underlyingPurchase.status = 'EXECUTION_SUCCESS_COVERAGE_INSUFFICIENT';
  } else {
    underlyingPurchase.status = 'FAILED';
  }
  return underlyingPurchase;
}

function observedFeeRate(fills) {
  const rates = (fills || [])
    .map(fill => optionalNumber(fill.feeRate))
    .filter(rate => rate !== null);
  return rates.length ? Math.max(...rates) : null;
}

function findShortOption(snapshot, symbol) {
  return (snapshot.positions || []).find(position => (
    position.category === 'option'
    && position.symbol === symbol
    && position.side === 'Sell'
    && optionalNumber(position.size) > 0
  )) || null;
}

function findShortOptionAtLeast(snapshot, symbol, qty) {
  return (snapshot.positions || []).find(position => (
    position.category === 'option'
    && position.symbol === symbol
    && position.side === 'Sell'
    && optionalNumber(position.size) >= qty
  )) || null;
}

function buildMarkdown(report) {
  const lines = [];
  lines.push('# Execution Laboratory');
  lines.push('');
  lines.push('## First Minimum Covered Call Acceptance Test');
  lines.push('');
  lines.push(`Generated at: ${report.metadata.generatedAt}`);
  lines.push(`Mode: ${report.metadata.execute ? 'EXECUTE' : 'READ-ONLY'}`);
  lines.push('');
  lines.push(`Initial Capital: ${formatUsd(report.initialSnapshot.account.usdtWalletBalance)}`);
  lines.push('');
  lines.push('## Underlying Purchase');
  lines.push('');
  lines.push(`Status: ${report.underlyingPurchase.status}`);
  lines.push(`Requested BTC Purchase: ${formatValue(report.underlyingPurchase.requestedQty)}`);
  lines.push(`Order Submitted: ${report.underlyingPurchase.orderSubmitted ? 'YES' : 'NO'}`);
  lines.push(`Order Filled: ${report.underlyingPurchase.orderFilled ? 'YES' : 'NO'}`);
  lines.push(`Executed BTC Purchase: ${formatValue(report.underlyingPurchase.executedQty)}`);
  lines.push(`BTC Before: ${formatValue(report.underlyingPurchase.btcWalletBalanceBefore)}`);
  lines.push(`BTC After: ${formatValue(report.underlyingPurchase.btcWalletBalanceAfter)}`);
  lines.push(`BTC Delta: ${formatValue(report.underlyingPurchase.btcWalletBalanceDelta)}`);
  lines.push(`BTC Balance Increased: ${report.underlyingPurchase.btcBalanceIncreased ? 'YES' : 'NO'}`);
  lines.push(`USDT Before: ${formatValue(report.underlyingPurchase.usdtWalletBalanceBefore)}`);
  lines.push(`USDT After: ${formatValue(report.underlyingPurchase.usdtWalletBalanceAfter)}`);
  lines.push(`USDT Delta: ${formatValue(report.underlyingPurchase.usdtWalletBalanceDelta)}`);
  lines.push(`BTC Net Received: ${formatValue(report.underlyingPurchase.btcNetReceived)}`);
  lines.push(`Fees: ${formatJsonValue(report.underlyingPurchase.fees)}`);
  lines.push(`Execution Success: ${report.underlyingPurchase.executionSuccess ? 'YES' : 'NO'}`);
  lines.push(`Coverage Sufficient: ${report.underlyingPurchase.coverageSufficient ? 'YES' : 'NO'}`);
  lines.push(`BTC Position: ${btcPositionText(report)}`);
  lines.push(`Average Price: ${formatUsd(report.underlyingPurchase.averagePrice)}`);
  lines.push(`Order ID: ${formatValue(report.underlyingPurchase.orderId)}`);
  lines.push('');
  lines.push('## Option Sale');
  lines.push('');
  lines.push(`Status: ${report.optionSale.status}`);
  lines.push(`Option Sale Attempted: ${report.optionSale.request || report.optionSale.response ? 'YES' : 'NO'}`);
  lines.push(`Short Call Instrument: ${formatValue(report.optionSelection.selected ? report.optionSelection.selected.symbol : null)}`);
  lines.push(`Premium: ${formatUsd(report.optionSale.premium)}`);
  lines.push(`Order ID: ${formatValue(report.optionSale.orderId)}`);
  lines.push('');
  lines.push('## Account State');
  lines.push('');
  lines.push(`Margin Used: ${formatUsd(report.finalSnapshot.account.initialMargin)}`);
  lines.push(`Available Capital: ${formatUsd(report.finalSnapshot.account.usdtWalletBalance)}`);
  lines.push(`Final Positions: ${report.finalSnapshot.positions.length}`);
  lines.push('');
  lines.push('## Warnings');
  lines.push('');
  if (report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('- None.');
  }
  lines.push('');
  if (report.recommendation) {
    lines.push('## Recommendation');
    lines.push('');
    lines.push(`Observed Fee Currency: ${formatValue(report.recommendation.observedFeeCurrency)}`);
    lines.push(`Observed Fee Rate: ${formatValue(report.recommendation.observedFeeRate)}`);
    lines.push(`Minimum Buy Qty For Observed Fee Rate: ${formatValue(report.recommendation.minimumBuyQtyForObservedFeeRate)}`);
    lines.push(`Configured Next Buy Qty: ${formatValue(report.recommendation.configuredNextBuyQty)}`);
    lines.push(`Reason: ${report.recommendation.reason}`);
    lines.push('');
  }
  lines.push('## Limitations');
  lines.push('');
  for (const limitation of report.limitations) lines.push(`- ${limitation}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function formatValue(value) {
  return value === null || value === undefined ? 'unknown' : String(value);
}

function formatUsd(value) {
  return value === null || value === undefined ? 'unknown' : `${value} USDT`;
}

function formatJsonValue(value) {
  if (value === null || value === undefined) return 'unknown';
  return JSON.stringify(value);
}

function btcPositionText(report) {
  if (report.underlyingPurchase.status === 'READ_ONLY_SKIPPED') {
    return `not tested (observed BTC wallet balance: ${formatValue(report.initialSnapshot.account.btcWalletBalance)})`;
  }
  return formatValue(report.underlyingPurchase.btcWalletBalanceAfter);
}

function writeOutputs(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, 'first_execution_probe.json');
  const mdPath = path.join(OUTPUT_DIR, 'first_execution_probe.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, buildMarkdown(report), 'utf8');
  return { jsonPath, mdPath };
}

function writeOptionSaleOutputs(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, 'option_sale_probe.json');
  const mdPath = path.join(OUTPUT_DIR, 'option_sale_probe.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, buildOptionSaleMarkdown(report), 'utf8');
  return { jsonPath, mdPath };
}

function buildOptionSaleMarkdown(report) {
  const lines = [];
  lines.push('# Execution Laboratory');
  lines.push('');
  lines.push('## Minimum Covered Call Option Sale Probe');
  lines.push('');
  lines.push(`Generated at: ${report.metadata.generatedAt}`);
  lines.push(`Mode: ${report.metadata.execute ? 'EXECUTE' : 'READ-ONLY'}`);
  lines.push('');
  lines.push(`BTC Available: ${formatValue(report.precheck.btcWalletBalance)}`);
  lines.push(`OPTION_PRECHECK_PASSED: ${report.flags.OPTION_PRECHECK_PASSED ? 'YES' : 'NO'}`);
  lines.push(`OPTION_ORDER_SUBMITTED: ${report.flags.OPTION_ORDER_SUBMITTED ? 'YES' : 'NO'}`);
  lines.push(`OPTION_ORDER_ACCEPTED: ${report.flags.OPTION_ORDER_ACCEPTED ? 'YES' : 'NO'}`);
  lines.push(`OPTION_ORDER_FILLED: ${report.flags.OPTION_ORDER_FILLED ? 'YES' : 'NO'}`);
  lines.push(`OPTION_EXECUTION_SUCCESS: ${report.flags.OPTION_EXECUTION_SUCCESS ? 'YES' : 'NO'}`);
  lines.push(`EXISTING_SHORT_CALL_FOUND: ${report.flags.EXISTING_SHORT_CALL_FOUND ? 'YES' : 'NO'}`);
  lines.push('');
  lines.push(`Short Call Instrument: ${formatValue(report.optionSelection.selected ? report.optionSelection.selected.symbol : null)}`);
  lines.push(`Order ID: ${formatValue(report.optionSale.orderId)}`);
  lines.push(`Order Status: ${formatValue(report.optionSale.orderStatus)}`);
  lines.push(`Premium: ${formatUsd(report.optionSale.premium)}`);
  lines.push('');
  lines.push('## Warnings');
  lines.push('');
  if (report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('- None.');
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function printOptionSaleSummary(report, paths) {
  console.log('Execution Laboratory');
  console.log('Minimum Covered Call Option Sale Probe');
  console.log('');
  console.log(`Mode: ${report.metadata.execute ? 'EXECUTE' : 'READ-ONLY'}`);
  console.log(`BTC Available: ${formatValue(report.precheck.btcWalletBalance)}`);
  console.log(`OPTION_PRECHECK_PASSED: ${report.flags.OPTION_PRECHECK_PASSED ? 'YES' : 'NO'}`);
  console.log(`OPTION_ORDER_SUBMITTED: ${report.flags.OPTION_ORDER_SUBMITTED ? 'YES' : 'NO'}`);
  console.log(`OPTION_ORDER_ACCEPTED: ${report.flags.OPTION_ORDER_ACCEPTED ? 'YES' : 'NO'}`);
  console.log(`OPTION_ORDER_FILLED: ${report.flags.OPTION_ORDER_FILLED ? 'YES' : 'NO'}`);
  console.log(`OPTION_EXECUTION_SUCCESS: ${report.flags.OPTION_EXECUTION_SUCCESS ? 'YES' : 'NO'}`);
  console.log(`EXISTING_SHORT_CALL_FOUND: ${report.flags.EXISTING_SHORT_CALL_FOUND ? 'YES' : 'NO'}`);
  console.log('');
  console.log(`Short Call Instrument: ${formatValue(report.optionSelection.selected ? report.optionSelection.selected.symbol : null)}`);
  console.log(`Order ID: ${formatValue(report.optionSale.orderId)}`);
  console.log(`Order Status: ${formatValue(report.optionSale.orderStatus)}`);
  console.log(`Premium: ${formatUsd(report.optionSale.premium)}`);
  console.log(`Warnings: ${report.warnings.length}`);
  if (report.warnings.length) {
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }
  console.log('');
  console.log(`Report JSON: ${paths.jsonPath}`);
  console.log(`Report MD: ${paths.mdPath}`);
}

function printSummary(report, paths) {
  console.log('Execution Laboratory');
  console.log('First Minimum Covered Call Acceptance Test');
  console.log('');
  console.log(`Mode: ${report.metadata.execute ? 'EXECUTE' : 'READ-ONLY'}`);
  console.log(`Initial Capital: ${formatUsd(report.initialSnapshot.account.usdtWalletBalance)}`);
  console.log('');
  console.log(`Underlying Purchase: ${report.underlyingPurchase.status}`);
  console.log(`Requested BTC Purchase: ${formatValue(report.underlyingPurchase.requestedQty)}`);
  console.log(`Order Submitted: ${report.underlyingPurchase.orderSubmitted ? 'YES' : 'NO'}`);
  console.log(`Order Filled: ${report.underlyingPurchase.orderFilled ? 'YES' : 'NO'}`);
  console.log(`Executed BTC Purchase: ${formatValue(report.underlyingPurchase.executedQty)}`);
  console.log(`BTC Before: ${formatValue(report.underlyingPurchase.btcWalletBalanceBefore)}`);
  console.log(`BTC After: ${formatValue(report.underlyingPurchase.btcWalletBalanceAfter)}`);
  console.log(`BTC Delta: ${formatValue(report.underlyingPurchase.btcWalletBalanceDelta)}`);
  console.log(`BTC Balance Increased: ${report.underlyingPurchase.btcBalanceIncreased ? 'YES' : 'NO'}`);
  console.log(`USDT Before: ${formatValue(report.underlyingPurchase.usdtWalletBalanceBefore)}`);
  console.log(`USDT After: ${formatValue(report.underlyingPurchase.usdtWalletBalanceAfter)}`);
  console.log(`USDT Delta: ${formatValue(report.underlyingPurchase.usdtWalletBalanceDelta)}`);
  console.log(`BTC Net Received: ${formatValue(report.underlyingPurchase.btcNetReceived)}`);
  console.log(`Fees: ${formatJsonValue(report.underlyingPurchase.fees)}`);
  console.log(`Execution Success: ${report.underlyingPurchase.executionSuccess ? 'YES' : 'NO'}`);
  console.log(`Coverage Sufficient: ${report.underlyingPurchase.coverageSufficient ? 'YES' : 'NO'}`);
  console.log(`BTC Position: ${btcPositionText(report)}`);
  console.log('');
  console.log(`Option Sale: ${report.optionSale.status}`);
  console.log(`Option Sale Attempted: ${report.optionSale.request || report.optionSale.response ? 'YES' : 'NO'}`);
  console.log(`Short Call Instrument: ${formatValue(report.optionSelection.selected ? report.optionSelection.selected.symbol : null)}`);
  console.log(`Premium: ${formatUsd(report.optionSale.premium)}`);
  console.log('');
  console.log(`Margin Used: ${formatUsd(report.finalSnapshot.account.initialMargin)}`);
  console.log(`Available Capital: ${formatUsd(report.finalSnapshot.account.usdtWalletBalance)}`);
  console.log(`Final Positions: ${report.finalSnapshot.positions.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  if (report.warnings.length) {
    for (const warning of report.warnings) console.log(`- ${warning}`);
  }
  console.log('');
  console.log(`Report JSON: ${paths.jsonPath}`);
  console.log(`Report MD: ${paths.mdPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const configErrors = validateConfig(config);
  if (configErrors.length) {
    console.error('Execution Lab first execution probe configuration error:');
    for (const error of configErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const warnings = [];
  const generatedAt = new Date().toISOString();

  if (args.sellExistingCallOnly) {
    const initialSnapshot = await captureAccountSnapshot(config, 'initial_option_sale_only', warnings);
    const spotTicker = await capture(
      'BTC spot ticker',
      warnings,
      () => bybitPublicGet(config, '/v5/market/tickers', { category: 'spot', symbol: 'BTCUSDT' }),
      null
    );
    const optionSelection = await selectWeeklyOtmCall(config, tickerPrice(spotTicker), warnings);
    const btcWalletBalance = optionalNumber(initialSnapshot.account.btcWalletBalance) || 0;
    const precheckPassed = btcWalletBalance >= TARGET_OPTION_QTY && Boolean(optionSelection.selected);
    const optionSale = {
      endpoint: '/v5/order/create',
      status: args.execute ? 'NOT_ATTEMPTED' : 'READ_ONLY_SKIPPED',
      orderId: null,
      orderLinkId: null,
      orderStatus: null,
      request: null,
      response: null,
      orderHistory: [],
      fills: [],
      premium: null,
      executedQty: null,
      error: null
    };
    const flags = {
      OPTION_PRECHECK_PASSED: precheckPassed,
      OPTION_ORDER_SUBMITTED: false,
      OPTION_ORDER_ACCEPTED: false,
      OPTION_ORDER_FILLED: false,
      OPTION_EXECUTION_SUCCESS: false,
      EXISTING_SHORT_CALL_FOUND: false
    };
    const existingShortCall = optionSelection.selected
      ? findShortOptionAtLeast(initialSnapshot, optionSelection.selected.symbol, TARGET_OPTION_QTY)
      : null;
    if (existingShortCall) {
      flags.EXISTING_SHORT_CALL_FOUND = true;
      optionSale.status = 'EXISTING_SHORT_CALL_FOUND';
      optionSale.orderStatus = 'AlreadyOpen';
      optionSale.shortPosition = existingShortCall;
      flags.OPTION_ORDER_FILLED = true;
      flags.OPTION_EXECUTION_SUCCESS = true;
      warnings.push(`Existing short call position found for ${optionSelection.selected.symbol}; no duplicate option order sent.`);
    }

    if (!precheckPassed) {
      warnings.push(`Option sale precheck failed: btcWalletBalance=${btcWalletBalance}, selectedOption=${optionSelection.selected ? optionSelection.selected.symbol : 'none'}.`);
    } else if (existingShortCall) {
      // Existing covered call exposure is enough to answer acceptance without duplicating risk.
    } else if (!args.execute) {
      warnings.push('Read-only mode: no option order sent. Re-run with --sell-existing-call-only --execute to attempt the Demo option sale.');
    } else {
      const sellRequest = {
        category: 'option',
        symbol: optionSelection.selected.symbol,
        side: 'Sell',
        orderType: 'Market',
        qty: String(TARGET_OPTION_QTY),
        orderLinkId: orderLinkId('ccw0eopt')
      };
      optionSale.request = sellRequest;
      try {
        const placed = await placeMarketOrder(config, sellRequest);
        flags.OPTION_ORDER_SUBMITTED = true;
        optionSale.response = placed.response;
        optionSale.orderId = placed.orderId;
        optionSale.orderLinkId = placed.orderLinkId;
        flags.OPTION_ORDER_ACCEPTED = Boolean(placed.response && placed.response.retCode === 0 && placed.orderId);
        optionSale.orderHistory = await orderHistory(config, 'option', placed.orderId, warnings, optionSelection.selected.symbol);
        optionSale.fills = await recentFills(config, 'option', placed.orderId, warnings, optionSelection.selected.symbol);
        const fillSummary = sumFills(optionSale.fills);
        optionSale.executedQty = fillSummary.execQty;
        optionSale.premium = fillSummary.execValue;
        const firstHistory = optionSale.orderHistory[0] || null;
        optionSale.orderStatus = firstHistory ? firstHistory.orderStatus || null : null;
        flags.OPTION_ORDER_FILLED = fillSummary.execQty > 0 || optionSale.orderStatus === 'Filled';
        flags.OPTION_EXECUTION_SUCCESS = flags.OPTION_ORDER_ACCEPTED && flags.OPTION_ORDER_FILLED;
        optionSale.status = flags.OPTION_EXECUTION_SUCCESS ? 'SUCCESS' : 'SUBMITTED_NOT_FILLED';
      } catch (error) {
        optionSale.status = 'FAILED';
        optionSale.error = {
          message: error.message || String(error),
          payload: error.payload || null
        };
      }
    }

    const finalSnapshot = await captureAccountSnapshot(config, 'final_option_sale_only', warnings);
    const report = {
      metadata: {
        track: 'Track B - Execution Laboratory',
        sprint: '0E',
        probe: 'bybit_option_sale_probe',
        generatedAt,
        environment: config.environment,
        baseUrl: config.baseUrl,
        accountType: config.accountType,
        configSource: path.relative(REPO_ROOT, config.sourcePath),
        execute: args.execute,
        readOnly: !args.execute,
        safetyGuard: args.execute ? '--execute provided; demo-only option sale enabled' : 'read-only default; no option order enabled',
        trackAInteraction: false,
        btcPurchaseAttempted: false,
        baselineCleanupAttempted: false
      },
      precheck: {
        targetOptionQty: TARGET_OPTION_QTY,
        btcWalletBalance,
        btcSufficient: btcWalletBalance >= TARGET_OPTION_QTY
      },
      optionSelection,
      flags,
      optionSale,
      initialSnapshot,
      finalSnapshot,
      warnings
    };
    const paths = writeOptionSaleOutputs(report);
    printOptionSaleSummary(report, paths);
    return;
  }

  if (args.diagnoseExistingReport) {
    const reportPath = path.join(OUTPUT_DIR, 'first_execution_probe.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    report.metadata.diagnosedAt = generatedAt;
    report.metadata.diagnosticReadOnly = true;
    const orderId = report.underlyingPurchase.orderId;
    if (orderId) {
      report.underlyingPurchase.fills = await recentFills(config, 'spot', orderId, warnings, 'BTCUSDT');
      report.underlyingPurchase.orderHistory = await orderHistory(config, 'spot', orderId, warnings, 'BTCUSDT');
      applyUnderlyingExecutionAnalysis(report.underlyingPurchase, report.initialSnapshot, report.afterUnderlyingSnapshot);
      if (report.underlyingPurchase.executionSuccess && !report.underlyingPurchase.coverageSufficient) {
        warnings.push(`Spot buy executed, but BTC net received ${report.underlyingPurchase.btcNetReceived} is below option coverage target ${TARGET_OPTION_QTY}; option sale remains aborted.`);
      }
    } else {
      warnings.push('No underlying orderId found in existing report; diagnostic could not fetch fills.');
    }
    const staleWarnings = new Set([
      'Underlying purchase did not confirm the required BTC wallet balance; option sale aborted fail-fast.',
      'Underlying buy executionSuccess=NO coverageSufficient=YES; option sale aborted fail-fast.'
    ]);
    report.warnings = [...new Set([...(report.warnings || []).filter(warning => !staleWarnings.has(warning)), ...warnings])];
    report.recommendation = {
      targetOptionQty: TARGET_OPTION_QTY,
      observedFeeCurrency: report.underlyingPurchase.fees && report.underlyingPurchase.fees.BTC ? 'BTC' : null,
      observedBtcFee: report.underlyingPurchase.fees ? report.underlyingPurchase.fees.BTC || null : null,
      observedFeeRate: observedFeeRate(report.underlyingPurchase.fills),
      minimumBuyQtyForObservedFeeRate: observedFeeRate(report.underlyingPurchase.fills) !== null
        ? roundUpNumber(TARGET_OPTION_QTY / (1 - observedFeeRate(report.underlyingPurchase.fills)))
        : null,
      configuredNextBuyQty: TARGET_BUY_QTY,
      reason: 'Observed spot fee was charged in BTC, so buying exactly 0.01 BTC produced less than 0.01 BTC net coverage.'
    };
    const paths = writeOutputs(report);
    printSummary(report, paths);
    return;
  }

  const initialSnapshot = await captureAccountSnapshot(config, 'initial', warnings);
  const spotTicker = await capture(
    'BTC spot ticker',
    warnings,
    () => bybitPublicGet(config, '/v5/market/tickers', { category: 'spot', symbol: 'BTCUSDT' }),
    null
  );
  const btcReferencePrice = tickerPrice(spotTicker);
  const optionSelection = await selectWeeklyOtmCall(config, btcReferencePrice, warnings);

  const metadata = {
    track: 'Track B - Execution Laboratory',
    sprint: '0E',
    probe: 'bybit_first_execution_probe',
    generatedAt,
    environment: config.environment,
    baseUrl: config.baseUrl,
    accountType: config.accountType,
    configSource: path.relative(REPO_ROOT, config.sourcePath),
    execute: args.execute,
    safetyGuard: args.execute ? '--execute provided; demo-only order placement enabled' : 'read-only default; no order placement enabled',
    readOnly: !args.execute,
    postRequestsSent: false,
    orderMutationEndpointsCalled: false,
    fundsMutationEndpointsCalled: false,
    trackAInteraction: false
  };

  const underlyingPurchase = {
    status: args.execute ? 'NOT_ATTEMPTED' : 'READ_ONLY_SKIPPED',
    orderId: null,
    orderLinkId: null,
    request: null,
    response: null,
    fills: [],
    averagePrice: null,
    executedQty: null,
    btcWalletBalanceAfter: initialSnapshot.account.btcWalletBalance,
    btcWalletBalanceDelta: null,
    observedBtcWalletBalanceBefore: initialSnapshot.account.btcWalletBalance,
    error: null
  };
  const optionSale = {
    status: args.execute ? 'NOT_ATTEMPTED' : 'READ_ONLY_SKIPPED',
    orderId: null,
    orderLinkId: null,
    request: null,
    response: null,
    fills: [],
    premium: null,
    executedQty: null,
    shortPosition: null,
    error: null
  };

  let afterUnderlyingSnapshot = initialSnapshot;
  let finalSnapshot = initialSnapshot;

  if (args.execute) {
    const buyRequest = {
      category: 'spot',
      symbol: 'BTCUSDT',
      side: 'Buy',
      orderType: 'Market',
      qty: String(TARGET_BUY_QTY),
      marketUnit: 'baseCoin',
      orderLinkId: orderLinkId('ccw-0e-btc-buy')
    };

    try {
      const placed = await placeMarketOrder(config, buyRequest);
      metadata.postRequestsSent = true;
      metadata.orderMutationEndpointsCalled = true;
      underlyingPurchase.request = placed.request;
      underlyingPurchase.response = placed.response;
      underlyingPurchase.orderId = placed.orderId;
      underlyingPurchase.orderLinkId = placed.orderLinkId;
      underlyingPurchase.requestedQty = TARGET_BUY_QTY;
      underlyingPurchase.fills = await recentFills(config, 'spot', placed.orderId, warnings, 'BTCUSDT');
      underlyingPurchase.orderHistory = await orderHistory(config, 'spot', placed.orderId, warnings, 'BTCUSDT');
      afterUnderlyingSnapshot = await captureAccountSnapshot(config, 'after_underlying', warnings);
      underlyingPurchase.btcWalletBalanceAfter = afterUnderlyingSnapshot.account.btcWalletBalance;
      const btcBefore = optionalNumber(initialSnapshot.account.btcWalletBalance) || 0;
      const btcAfter = optionalNumber(afterUnderlyingSnapshot.account.btcWalletBalance);
      const btcDelta = btcAfter === null ? null : roundNumber(btcAfter - btcBefore);
      underlyingPurchase.btcWalletBalanceDelta = btcDelta;
      applyUnderlyingExecutionAnalysis(underlyingPurchase, initialSnapshot, afterUnderlyingSnapshot);
    } catch (error) {
      metadata.postRequestsSent = true;
      metadata.orderMutationEndpointsCalled = true;
      underlyingPurchase.status = 'FAILED';
      underlyingPurchase.error = {
        message: error.message || String(error),
        payload: error.payload || null
      };
      finalSnapshot = await captureAccountSnapshot(config, 'final_after_underlying_failure', warnings);
      const report = buildReport(metadata, initialSnapshot, afterUnderlyingSnapshot, finalSnapshot, optionSelection, underlyingPurchase, optionSale, warnings);
      const paths = writeOutputs(report);
      printSummary(report, paths);
      process.exitCode = 1;
      return;
    }

    if (!underlyingPurchase.executionSuccess || !underlyingPurchase.coverageSufficient) {
      warnings.push(`Underlying buy executionSuccess=${underlyingPurchase.executionSuccess ? 'YES' : 'NO'} coverageSufficient=${underlyingPurchase.coverageSufficient ? 'YES' : 'NO'}; option sale aborted fail-fast.`);
      finalSnapshot = await captureAccountSnapshot(config, 'final_underlying_not_confirmed', warnings);
      const report = buildReport(metadata, initialSnapshot, afterUnderlyingSnapshot, finalSnapshot, optionSelection, underlyingPurchase, optionSale, warnings);
      const paths = writeOutputs(report);
      printSummary(report, paths);
      process.exitCode = 1;
      return;
    }

    if (!optionSelection.selected) {
      warnings.push('No matching next-Friday OTM05 call instrument found; option sale aborted fail-fast.');
      finalSnapshot = await captureAccountSnapshot(config, 'final_no_option_instrument', warnings);
      const report = buildReport(metadata, initialSnapshot, afterUnderlyingSnapshot, finalSnapshot, optionSelection, underlyingPurchase, optionSale, warnings);
      const paths = writeOutputs(report);
      printSummary(report, paths);
      process.exitCode = 1;
      return;
    }

    const sellRequest = {
      category: 'option',
      symbol: optionSelection.selected.symbol,
      side: 'Sell',
      orderType: 'Market',
      qty: String(TARGET_OPTION_QTY),
      orderLinkId: orderLinkId('ccw-0e-call-sell')
    };

    try {
      const placed = await placeMarketOrder(config, sellRequest);
      optionSale.request = placed.request;
      optionSale.response = placed.response;
      optionSale.orderId = placed.orderId;
      optionSale.orderLinkId = placed.orderLinkId;
      optionSale.fills = await recentFills(config, 'option', placed.orderId, warnings, optionSelection.selected.symbol);
      const fillSummary = sumFills(optionSale.fills);
      optionSale.executedQty = fillSummary.execQty;
      optionSale.premium = fillSummary.execValue;
      finalSnapshot = await captureAccountSnapshot(config, 'final', warnings);
      optionSale.shortPosition = findShortOption(finalSnapshot, optionSelection.selected.symbol);
      optionSale.status = optionSale.shortPosition ? 'SUCCESS' : 'FAILED';
    } catch (error) {
      optionSale.status = 'FAILED';
      optionSale.error = {
        message: error.message || String(error),
        payload: error.payload || null
      };
      finalSnapshot = await captureAccountSnapshot(config, 'final_after_option_failure', warnings);
      const report = buildReport(metadata, initialSnapshot, afterUnderlyingSnapshot, finalSnapshot, optionSelection, underlyingPurchase, optionSale, warnings);
      const paths = writeOutputs(report);
      printSummary(report, paths);
      process.exitCode = 1;
      return;
    }
  }

  if (!args.execute) {
    warnings.push('Read-only mode: no orders were sent. Re-run with --execute to attempt the Demo acceptance test.');
  }
  finalSnapshot = args.execute ? finalSnapshot : await captureAccountSnapshot(config, 'final_read_only', warnings);
  const report = buildReport(metadata, initialSnapshot, afterUnderlyingSnapshot, finalSnapshot, optionSelection, underlyingPurchase, optionSale, warnings);
  const paths = writeOutputs(report);
  printSummary(report, paths);
}

function buildReport(metadata, initialSnapshot, afterUnderlyingSnapshot, finalSnapshot, optionSelection, underlyingPurchase, optionSale, warnings) {
  return {
    metadata,
    testPlan: {
      targetUnderlying: '+0.01 BTC',
      targetBuyQty: TARGET_BUY_QTY,
      targetOptionQty: TARGET_OPTION_QTY,
      targetOption: '-0.01 BTC Weekly OTM05 Call',
      nextFriday: optionSelection.targetExpiry,
      targetStrike: optionSelection.targetStrike,
      continuousAutomation: false,
      retries: false,
      scheduler: false
    },
    initialSnapshot,
    underlyingPurchase,
    afterUnderlyingSnapshot,
    optionSelection,
    optionSale,
    finalSnapshot,
    warnings,
    limitations: [
      'Default mode is read-only and does not empirically test order acceptance.',
      'Execute mode is Demo-only but places real Demo orders and intentionally does not manage or unwind positions.',
      'The script is fail-fast and has no retries; transient API or matching-engine behavior may require manual review.',
      'Spot BTC is confirmed through wallet BTC balance because spot holdings are not represented like derivatives positions.',
      'Spot buy execution and covered-call coverage are tracked separately because fees may be charged in BTC.',
      'Option premium is estimated from execution-list execValue when available.',
      'No Track A files, live monitoring workflows, strategy automation, schedulers, or continuous loops are used.'
    ]
  };
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab first execution probe failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
