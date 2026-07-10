const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');

const LAB_DIR = __dirname;
const REPO_ROOT = path.resolve(LAB_DIR, '..', '..');
const LOCAL_CONFIG_PATH = path.join(LAB_DIR, 'execution_lab_config.json');
const EXAMPLE_CONFIG_PATH = path.join(LAB_DIR, 'execution_lab_config.example.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated', 'execution_lab');
const BASELINE_OUTPUT_DIR = path.join(REPO_ROOT, 'execution_lab', 'output');
const DEMO_BASE_URL = 'https://api-demo.bybit.com';
const DEMO_FUNDS_ENDPOINT = '/v5/account/demo-apply-money';
const MAX_REDUCTION_USDT = 10;
const MIN_TARGET_USDT = 500;
const MAX_TARGET_USDT = 50000;
const BASELINE_TARGETS = {
  BTC: 0,
  ETH: 0,
  USDC: 0,
  USDT: 2000
};
const BASELINE_COINS = Object.keys(BASELINE_TARGETS);
const OPTION_BASE_COINS = ['BTC', 'ETH'];
const PRIMARY_WALLET_COINS = ['USDT', 'USDC', 'BTC', 'ETH'];
const ADD_ADJUST_TYPE = 0;
const REDUCE_ADJUST_TYPE = 1;
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
    errors.push('Execution Lab Sprint 0B only allows environment="demo".');
  }
  if (config.baseUrl !== DEMO_BASE_URL) {
    errors.push(`Execution Lab Sprint 0B only allows baseUrl=${DEMO_BASE_URL}.`);
  }
  if (!config.apiKey || !config.apiSecret) {
    errors.push(`Missing demo credentials. Create ${LOCAL_CONFIG_PATH} from ${EXAMPLE_CONFIG_PATH}.`);
  }
  return errors;
}

function parseArgs(argv) {
  const result = {
    mode: 'dry-run',
    requestedReduction: null,
    targetUsdt: null,
    confirmTargetReduction: false,
    baseline: false,
    confirmBaselineClean: false,
    errors: []
  };

  for (const arg of argv) {
    if (arg === '--confirm-target-reduction') {
      result.confirmTargetReduction = true;
      continue;
    }

    if (arg === '--baseline-clean') {
      result.baseline = true;
      result.mode = 'baseline-dry-run';
      continue;
    }

    if (arg === '--confirm-baseline-clean') {
      result.confirmBaselineClean = true;
      continue;
    }

    if (arg.startsWith('--target-usdt=')) {
      const raw = arg.slice('--target-usdt='.length);
      const target = Number(raw);
      if (!Number.isFinite(target)) {
        result.errors.push('--target-usdt must be a number.');
        continue;
      }
      if (target < MIN_TARGET_USDT || target > MAX_TARGET_USDT) {
        result.errors.push(`--target-usdt must be between ${MIN_TARGET_USDT} and ${MAX_TARGET_USDT} USDT.`);
        continue;
      }
      result.targetUsdt = roundAmount(target);
      result.mode = 'target-dry-run';
      continue;
    }

    if (!arg.startsWith('--reduce-test-usdt=')) {
      result.errors.push(`Unsupported argument: ${arg}`);
      continue;
    }
    const raw = arg.slice('--reduce-test-usdt='.length);
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      result.errors.push('--reduce-test-usdt must be a positive number.');
      continue;
    }
    if (amount > MAX_REDUCTION_USDT) {
      result.errors.push(`--reduce-test-usdt cannot exceed ${MAX_REDUCTION_USDT} USDT.`);
      continue;
    }
    result.mode = 'reduce-test';
    result.requestedReduction = roundAmount(amount);
  }

  if (result.requestedReduction !== null && result.targetUsdt !== null) {
    result.errors.push('Use either --reduce-test-usdt or --target-usdt, not both.');
  }
  if (result.confirmTargetReduction && result.targetUsdt === null) {
    result.errors.push('--confirm-target-reduction requires --target-usdt.');
  }
  if (result.confirmBaselineClean && !result.baseline) {
    result.errors.push('--confirm-baseline-clean requires --baseline-clean.');
  }
  if (result.baseline && (result.requestedReduction !== null || result.targetUsdt !== null)) {
    result.errors.push('Use --baseline-clean by itself; do not combine it with USDT test or target modes.');
  }
  if (result.targetUsdt !== null && result.confirmTargetReduction) {
    result.mode = 'target-reduction';
  }
  if (result.baseline && result.confirmBaselineClean) {
    result.mode = 'baseline-clean';
  }

  return result;
}

function roundAmount(value) {
  return Math.round(Number(value) * 100000000) / 100000000;
}

function roundUpToInteger(value) {
  return Math.ceil(Number(value));
}

function queryString(params) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function signRequest(config, timestamp, payload) {
  const signingPayload = `${timestamp}${config.apiKey}${config.recvWindow}${payload}`;
  return crypto
    .createHmac('sha256', config.apiSecret)
    .update(signingPayload)
    .digest('hex');
}

function bybitGet(config, pathname, params = {}) {
  const query = queryString(params);
  const timestamp = String(Date.now());
  const signature = signRequest(config, timestamp, query);
  const url = `${config.baseUrl}${pathname}${query ? `?${query}` : ''}`;
  return bybitRequest(config, 'GET', url, pathname, signature, timestamp, null);
}

function bybitPost(config, pathname, body) {
  const timestamp = String(Date.now());
  const jsonBody = JSON.stringify(body);
  const signature = signRequest(config, timestamp, jsonBody);
  const url = `${config.baseUrl}${pathname}`;
  return bybitRequest(config, 'POST', url, pathname, signature, timestamp, jsonBody);
}

function bybitRequest(config, method, url, pathname, signature, timestamp, jsonBody) {
  const headers = {
    'X-BAPI-API-KEY': config.apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-TYPE': '2',
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': config.recvWindow
  };
  if (jsonBody !== null) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(jsonBody);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers }, response => {
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
          reject(new Error(`Invalid JSON from ${pathname}: ${error.message}`));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${pathname}: ${body.slice(0, 200)}`));
          return;
        }
        if (payload && payload.retCode !== 0) {
          reject(new Error(`Bybit retCode ${payload.retCode} from ${pathname}: ${payload.retMsg || 'unknown error'}`));
          return;
        }
        resolve(payload);
      });
    });
    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timeout from ${pathname}`));
    });
    request.on('error', reject);
    if (jsonBody !== null) request.write(jsonBody);
    request.end();
  });
}

function resultList(payload) {
  return payload && payload.result && Array.isArray(payload.result.list) ? payload.result.list : [];
}

function walletCoins(walletPayload) {
  return resultList(walletPayload).flatMap(account => (account.coin || []).map(coin => ({
    accountType: account.accountType || null,
    coin: coin.coin || null,
    walletBalance: coin.walletBalance || null,
    equity: coin.equity || null,
    usdValue: coin.usdValue || null
  })));
}

function findCoin(wallet, coin) {
  return (wallet || []).find(row => row.coin === coin) || null;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function printableValue(value) {
  return value === null || value === undefined || value === '' ? 'N/A' : String(value);
}

function nonZeroNumber(value) {
  const number = optionalNumber(value);
  return number !== null && Math.abs(number) > 1e-12;
}

function numericWalletBalance(wallet, coin) {
  const row = findCoin(wallet, coin);
  if (!row) return null;
  const value = Number(row.walletBalance);
  return Number.isFinite(value) ? value : null;
}

function resultPayloadList(payload) {
  return payload && payload.result && Array.isArray(payload.result.list) ? payload.result.list : [];
}

function nonZeroPositions(payload, category) {
  return resultPayloadList(payload)
    .filter(position => optionalNumber(position.size) !== null && optionalNumber(position.size) !== 0)
    .map(position => ({
      category,
      symbol: position.symbol || null,
      side: position.side || null,
      size: roundAmount(position.size),
      avgPrice: roundAmount(position.avgPrice),
      markPrice: roundAmount(position.markPrice),
      positionValue: roundAmount(position.positionValue),
      unrealisedPnl: roundAmount(position.unrealisedPnl)
    }));
}

function compactOrders(payload, category) {
  return resultPayloadList(payload).map(order => ({
    category,
    symbol: order.symbol || null,
    orderId: order.orderId || null,
    side: order.side || null,
    orderType: order.orderType || null,
    orderStatus: order.orderStatus || null,
    qty: roundAmount(order.qty),
    price: roundAmount(order.price),
    createdTime: order.createdTime || null,
    updatedTime: order.updatedTime || null
  }));
}

async function capture(label, warnings, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    warnings.push(`${label} unavailable: ${error.message || String(error)}`);
    return fallback;
  }
}

async function accountState(config, warnings) {
  const walletPayload = await bybitGet(config, '/v5/account/wallet-balance', {
    accountType: config.accountType
  });
  const account = resultPayloadList(walletPayload)[0] || {};
  const wallet = walletCoins(walletPayload);
  const positions = [];
  const openOrders = [];

  const linearPositionsPayload = await capture(
    'linear positions',
    warnings,
    () => bybitGet(config, '/v5/position/list', { category: 'linear', settleCoin: 'USDT' }),
    null
  );
  positions.push(...nonZeroPositions(linearPositionsPayload, 'linear'));

  for (const baseCoin of OPTION_BASE_COINS) {
    const payload = await capture(
      `option ${baseCoin} positions`,
      warnings,
      () => bybitGet(config, '/v5/position/list', { category: 'option', baseCoin }),
      null
    );
    positions.push(...nonZeroPositions(payload, `option:${baseCoin}`));
  }

  const spotOrdersPayload = await capture(
    'spot open orders',
    warnings,
    () => bybitGet(config, '/v5/order/realtime', { category: 'spot', limit: 50 }),
    null
  );
  openOrders.push(...compactOrders(spotOrdersPayload, 'spot'));

  const linearOrdersPayload = await capture(
    'linear open orders',
    warnings,
    () => bybitGet(config, '/v5/order/realtime', { category: 'linear', settleCoin: 'USDT', limit: 50 }),
    null
  );
  openOrders.push(...compactOrders(linearOrdersPayload, 'linear'));

  for (const baseCoin of OPTION_BASE_COINS) {
    const payload = await capture(
      `option ${baseCoin} open orders`,
      warnings,
      () => bybitGet(config, '/v5/order/realtime', { category: 'option', baseCoin, limit: 50 }),
      null
    );
    openOrders.push(...compactOrders(payload, `option:${baseCoin}`));
  }

  return {
    account: {
      totalEquity: roundAmount(account.totalEquity),
      totalWalletBalance: roundAmount(account.totalWalletBalance),
      totalAvailableBalance: roundAmount(account.totalAvailableBalance),
      totalMarginBalance: roundAmount(account.totalMarginBalance),
      totalInitialMargin: roundAmount(account.totalInitialMargin),
      totalMaintenanceMargin: roundAmount(account.totalMaintenanceMargin),
      marginUsed: roundAmount(account.totalInitialMargin),
      positionsCount: positions.length,
      openOrdersCount: openOrders.length
    },
    balances: BASELINE_COINS.reduce((acc, coin) => {
      acc[coin] = numericWalletBalance(wallet, coin) || 0;
      return acc;
    }, {}),
    wallet,
    positions,
    openOrders
  };
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${timestampForFile()}_bybit_demo_funds_probe.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function writeBaselineReport(report) {
  fs.mkdirSync(BASELINE_OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(BASELINE_OUTPUT_DIR, 'laboratory_baseline.json');
  const mdPath = path.join(BASELINE_OUTPUT_DIR, 'laboratory_baseline.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, buildBaselineMarkdown(report), 'utf8');
  return { jsonPath, mdPath };
}

function buildBaselineMarkdown(report) {
  const final = report.finalState || report.beforeState;
  const before = report.beforeState;
  const lines = [];
  lines.push('# Execution Laboratory Baseline');
  lines.push('');
  lines.push(`Generated at: ${report.metadata.generatedAt}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push('');
  lines.push('## Account Readiness View');
  lines.push('');
  lines.push('USDT wallet balance is not total account capital.');
  lines.push('Use total equity / total wallet balance for pilot readiness.');
  lines.push('');
  if (before) {
    lines.push(`Before Total Equity: ${before.account.totalEquity}`);
    lines.push(`Before Total Wallet Balance: ${before.account.totalWalletBalance}`);
    lines.push(`Before Total Available Balance: ${before.account.totalAvailableBalance}`);
    lines.push(`Before Margin Used: ${before.account.marginUsed}`);
    lines.push('');
  }
  lines.push('## Baseline Coin Balances');
  lines.push('');
  lines.push(`BTC: ${final.balances.BTC}`);
  lines.push(`ETH: ${final.balances.ETH}`);
  lines.push(`USDC: ${final.balances.USDC}`);
  lines.push(`USDT: ${final.balances.USDT}`);
  lines.push('');
  lines.push(`Positions: ${final.account.positionsCount}`);
  lines.push(`Open Orders: ${final.account.openOrdersCount}`);
  lines.push(`Margin Used: ${final.account.marginUsed}`);
  lines.push('');
  lines.push(`Baseline Clean: ${report.baselineClean ? 'YES' : 'NO'}`);
  lines.push('');
  if (before) {
    lines.push('## Before Wallet Detail');
    lines.push('');
    for (const coin of PRIMARY_WALLET_COINS) {
      const row = findCoin(before.wallet, coin);
      lines.push(`- ${coin}: wallet=${row ? printableValue(row.walletBalance) : 'N/A'}, equity=${row ? printableValue(row.equity) : 'N/A'}, usdValue=${row ? printableValue(row.usdValue) : 'N/A'}`);
    }
    const otherCoins = before.wallet
      .filter(row => row.coin && !PRIMARY_WALLET_COINS.includes(row.coin))
      .filter(row => nonZeroNumber(row.walletBalance) || nonZeroNumber(row.equity) || nonZeroNumber(row.usdValue));
    if (otherCoins.length) {
      lines.push('');
      lines.push('Other non-zero coins:');
      for (const row of otherCoins) {
        lines.push(`- ${row.coin}: wallet=${printableValue(row.walletBalance)}, equity=${printableValue(row.equity)}, usdValue=${printableValue(row.usdValue)}`);
      }
    }
    lines.push('');
    lines.push('## Before Positions And Orders');
    lines.push('');
    lines.push(`Positions: ${before.positions.length}`);
    for (const position of before.positions) {
      lines.push(`- ${position.category} ${position.symbol}: ${position.side} size=${position.size}, avg=${position.avgPrice}, mark=${position.markPrice}, value=${position.positionValue}, uPnL=${position.unrealisedPnl}`);
    }
    if (!before.positions.length) lines.push('- None.');
    lines.push('');
    lines.push(`Open Orders: ${before.openOrders.length}`);
    for (const order of before.openOrders) {
      lines.push(`- ${order.category} ${order.symbol}: ${order.side} ${order.orderType} qty=${order.qty}, price=${order.price}, status=${order.orderStatus}`);
    }
    if (!before.openOrders.length) lines.push('- None.');
    lines.push('');
  }
  lines.push('## Planned Reductions');
  lines.push('');
  if (report.plannedBaselineReductions.length) {
    for (const row of report.plannedBaselineReductions) {
      lines.push(`- ${row.coin}: ${row.amountStr}`);
    }
  } else {
    lines.push('- None.');
  }
  lines.push('');
  lines.push('## Planned Additions');
  lines.push('');
  if (report.plannedBaselineAdditions && report.plannedBaselineAdditions.length) {
    for (const row of report.plannedBaselineAdditions) {
      lines.push(`- ${row.coin}: ${row.amountStr}`);
    }
  } else {
    lines.push('- None.');
  }
  lines.push('');
  lines.push('## Warnings');
  lines.push('');
  if (report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('- None.');
  }
  lines.push('');
  lines.push('## Safety');
  lines.push('');
  lines.push('- Demo environment only.');
  lines.push('- Demo funds endpoint only.');
  lines.push('- Reduces excess BTC/ETH/USDC/USDT with adjustType=1.');
  lines.push('- Adds only missing USDT with adjustType=0 when baseline USDT is below 2000.');
  lines.push('- No order endpoints.');
  lines.push('- No Track A interaction.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function printWalletSummary(label, wallet) {
  for (const coin of PRIMARY_WALLET_COINS) {
    const row = findCoin(wallet, coin);
    console.log(`${label} ${coin} wallet balance: ${row ? printableValue(row.walletBalance) : 'N/A'}`);
    console.log(`${label} ${coin} equity: ${row ? printableValue(row.equity) : 'N/A'}`);
    if (coin === 'BTC' || coin === 'ETH') {
      console.log(`${label} ${coin} USD value: ${row ? printableValue(row.usdValue) : 'N/A'}`);
    }
  }
  const otherCoins = (wallet || [])
    .filter(row => row.coin && !PRIMARY_WALLET_COINS.includes(row.coin))
    .filter(row => nonZeroNumber(row.walletBalance) || nonZeroNumber(row.equity) || nonZeroNumber(row.usdValue));
  if (otherCoins.length) {
    console.log(`${label} other non-zero coins:`);
    for (const row of otherCoins) {
      console.log(`- ${row.coin}: wallet=${printableValue(row.walletBalance)}, equity=${printableValue(row.equity)}, usdValue=${printableValue(row.usdValue)}`);
    }
  } else {
    console.log(`${label} other non-zero coins: none`);
  }
}

function printStateSummary(label, state) {
  if (!state) return;
  console.log(`${label} total equity: ${printableValue(state.account.totalEquity)}`);
  console.log(`${label} total wallet balance: ${printableValue(state.account.totalWalletBalance)}`);
  console.log(`${label} total available balance: ${printableValue(state.account.totalAvailableBalance)}`);
  console.log(`${label} margin used: ${printableValue(state.account.marginUsed)}`);
  console.log(`${label} positions count: ${state.positions.length}`);
  if (state.positions.length) {
    for (const position of state.positions) {
      console.log(`- ${position.category} ${position.symbol}: ${position.side} size=${position.size}, avg=${position.avgPrice}, mark=${position.markPrice}, value=${position.positionValue}, uPnL=${position.unrealisedPnl}`);
    }
  }
  console.log(`${label} open orders count: ${state.openOrders.length}`);
  if (state.openOrders.length) {
    for (const order of state.openOrders) {
      console.log(`- ${order.category} ${order.symbol}: ${order.side} ${order.orderType} qty=${order.qty}, price=${order.price}, status=${order.orderStatus}`);
    }
  }
}

function printSummary(snapshot, outputPath) {
  console.log('Execution Lab Bybit demo funds probe');
  console.log(`Mode: ${snapshot.mode}`);
  console.log(`Environment: ${snapshot.metadata.environment}`);
  console.log(`Base URL: ${snapshot.metadata.baseUrl}`);
  console.log(`Requested reduction: ${snapshot.requestedReduction === null ? 'none' : `${snapshot.requestedReduction} USDT`}`);
  console.log(`Target USDT: ${snapshot.targetUsdt === null ? 'none' : snapshot.targetUsdt}`);
  console.log(`Planned reduction: ${snapshot.plannedReduction === null ? 'none' : `${snapshot.plannedReduction} USDT`}`);
  console.log('Readiness note: USDT wallet balance is not total account capital.');
  console.log('Readiness note: Use total equity / total wallet balance for pilot readiness.');
  printStateSummary('Before', snapshot.beforeState);
  printWalletSummary('Before', snapshot.beforeWallet);
  if (snapshot.finalState && snapshot.finalState !== snapshot.beforeState) printStateSummary('After', snapshot.finalState);
  if (snapshot.afterWallet) printWalletSummary('After', snapshot.afterWallet);
  console.log(`POST called: ${snapshot.postCalled}`);
  console.log(`Warnings: ${snapshot.warnings.length}`);
  if (snapshot.warnings.length) {
    for (const warning of snapshot.warnings) console.log(`- ${warning}`);
  }
  console.log(`Snapshot: ${outputPath}`);
  if (snapshot.baselineReportPaths) {
    console.log(`Baseline JSON: ${snapshot.baselineReportPaths.jsonPath}`);
    console.log(`Baseline MD: ${snapshot.baselineReportPaths.mdPath}`);
  }
}

function demoFundsRequestBody(amount, coin = 'USDT', adjustType = REDUCE_ADJUST_TYPE) {
  /*
   * Bybit V5 Demo Trading Service documents POST /v5/account/demo-apply-money
   * for requesting demo funds changes. The endpoint supports adjustType:
   * 0 means add demo funds; 1 means reduce demo funds. This Sprint 0B probe
   * hardcodes adjustType=1 and coin=USDT. The one-off test mode caps
   * amountStr at 10 USDT. Target-balance mode requires a separate explicit
   * confirmation flag and only reduces when the current balance is above target.
   *
   * This is not an order endpoint and must not be reused for trading actions.
   */
  return {
    adjustType,
    utaDemoApplyMoney: [
      {
        coin,
        amountStr: String(amount)
      }
    ]
  };
}

function demoFundsMultiCoinRequestBody(rows) {
  return {
    adjustType: REDUCE_ADJUST_TYPE,
    utaDemoApplyMoney: rows.map(row => ({
      coin: row.coin,
      amountStr: row.amountStr
    }))
  };
}

function demoFundsBaselineAddRequestBody(rows) {
  return {
    adjustType: ADD_ADJUST_TYPE,
    utaDemoApplyMoney: rows.map(row => ({
      coin: row.coin,
      amountStr: row.amountStr
    }))
  };
}

function plannedBaselineReductionsFromState(state) {
  return BASELINE_COINS
    .map(coin => {
      const current = optionalNumber(state.balances[coin]) || 0;
      const target = BASELINE_TARGETS[coin];
      const reduction = roundAmount(current - target);
      return reduction > 0 ? { coin, amount: reduction, amountStr: String(reduction), current, target } : null;
    })
    .filter(Boolean);
}

function plannedBaselineAdditionsFromState(state) {
  const current = optionalNumber(state.balances.USDT) || 0;
  const target = BASELINE_TARGETS.USDT;
  const addition = roundAmount(roundUpToInteger(target - current));
  return addition > 0 ? [{ coin: 'USDT', amount: addition, amountStr: String(addition), current, target }] : [];
}

function demoFundsRequestSucceeded(response) {
  if (!response || response.retCode !== 0) return false;
  const result = response.result || {};
  if (result.orderStatus && result.orderStatus !== 'SUCCESS') return false;
  if (result.resultCode && result.resultCode !== '0') return false;
  return true;
}

function isBaselineClean(state) {
  const balances = state.balances;
  return (
    Math.abs((balances.BTC || 0) - BASELINE_TARGETS.BTC) < 1e-8
    && Math.abs((balances.ETH || 0) - BASELINE_TARGETS.ETH) < 1e-8
    && Math.abs((balances.USDC || 0) - BASELINE_TARGETS.USDC) < 1e-8
    && Math.abs((balances.USDT || 0) - BASELINE_TARGETS.USDT) < 1e-4
    && state.account.positionsCount === 0
    && state.account.openOrdersCount === 0
    && (state.account.marginUsed || 0) === 0
  );
}

async function main() {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));
  const configErrors = validateConfig(config);
  const errors = [...configErrors, ...args.errors];
  if (errors.length) {
    console.error('Execution Lab funds probe configuration error:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const warnings = [];
  const generatedAt = new Date().toISOString();
  const beforeState = args.baseline ? await accountState(config, warnings) : null;
  const beforePayload = await bybitGet(config, '/v5/account/wallet-balance', {
    accountType: config.accountType
  });
  const beforeWallet = walletCoins(beforePayload);
  const beforeUsdtBalance = numericWalletBalance(beforeWallet, 'USDT');

  let apiResponse = null;
  let afterWallet = null;
  let finalState = null;
  let postCalled = false;
  let plannedReduction = args.requestedReduction;
  let plannedBaselineReductions = [];
  let plannedBaselineAdditions = [];
  let baselineReportPaths = null;

  if (args.mode === 'dry-run') {
    warnings.push(`Dry run only: no POST sent. To reduce demo USDT, rerun with --reduce-test-usdt=${MAX_REDUCTION_USDT} or less.`);
  } else if (args.mode === 'baseline-dry-run' || args.mode === 'baseline-clean') {
    plannedBaselineReductions = plannedBaselineReductionsFromState(beforeState);
    plannedBaselineAdditions = plannedBaselineAdditionsFromState(beforeState);
    if (!plannedBaselineReductions.length && !plannedBaselineAdditions.length) {
      warnings.push('Baseline already matches target balances; no POST sent.');
      finalState = await accountState(config, warnings);
    } else if (args.mode === 'baseline-dry-run') {
      warnings.push('Baseline dry run only: no POST sent. Add --confirm-baseline-clean to execute demo fund baseline adjustments.');
      finalState = beforeState;
    } else {
      apiResponse = {};
      if (plannedBaselineReductions.length) {
        const requestBody = demoFundsMultiCoinRequestBody(plannedBaselineReductions);
        postCalled = true;
        apiResponse.reduction = await bybitPost(config, DEMO_FUNDS_ENDPOINT, requestBody);
        if (!demoFundsRequestSucceeded(apiResponse.reduction)) {
          warnings.push(`Baseline reduction request returned non-success payload: ${JSON.stringify(apiResponse.reduction.result || apiResponse.reduction)}`);
        }
      }
      if (plannedBaselineAdditions.length) {
        const requestBody = demoFundsBaselineAddRequestBody(plannedBaselineAdditions);
        postCalled = true;
        apiResponse.addition = await bybitPost(config, DEMO_FUNDS_ENDPOINT, requestBody);
        if (!demoFundsRequestSucceeded(apiResponse.addition)) {
          warnings.push(`Baseline addition request returned non-success payload: ${JSON.stringify(apiResponse.addition.result || apiResponse.addition)}`);
        }
      }
      let interimState = await accountState(config, warnings);
      const postAdditionReductions = plannedBaselineReductionsFromState(interimState);
      if (postAdditionReductions.length) {
        const requestBody = demoFundsMultiCoinRequestBody(postAdditionReductions);
        postCalled = true;
        apiResponse.postAdditionReduction = await bybitPost(config, DEMO_FUNDS_ENDPOINT, requestBody);
        if (!demoFundsRequestSucceeded(apiResponse.postAdditionReduction)) {
          warnings.push(`Post-addition reduction request returned non-success payload: ${JSON.stringify(apiResponse.postAdditionReduction.result || apiResponse.postAdditionReduction)}`);
        }
        plannedBaselineReductions.push(...postAdditionReductions.map(row => ({ ...row, phase: 'post-addition-reconcile' })));
      }
      finalState = await accountState(config, warnings);
      afterWallet = finalState.wallet;
    }
  } else if (args.mode === 'target-dry-run' || args.mode === 'target-reduction') {
    if (beforeUsdtBalance === null) {
      throw new Error('USDT wallet balance unavailable; cannot calculate target-balance reduction.');
    }
    if (beforeUsdtBalance < args.targetUsdt) {
      throw new Error(`Current USDT balance ${beforeUsdtBalance} is below target ${args.targetUsdt}; aborting because this probe never adds funds.`);
    }
    plannedReduction = roundAmount(beforeUsdtBalance - args.targetUsdt);
    if (plannedReduction === 0) {
      warnings.push(`Current USDT balance already equals target ${args.targetUsdt}; no POST sent.`);
    } else if (args.mode === 'target-dry-run') {
      warnings.push(`Target dry run only: no POST sent. Would reduce ${plannedReduction} USDT to reach target ${args.targetUsdt}. Add --confirm-target-reduction to execute.`);
    } else {
      const requestBody = demoFundsRequestBody(plannedReduction);
      postCalled = true;
      apiResponse = await bybitPost(config, DEMO_FUNDS_ENDPOINT, requestBody);
      const afterPayload = await bybitGet(config, '/v5/account/wallet-balance', {
        accountType: config.accountType
      });
      afterWallet = walletCoins(afterPayload);
    }
  } else {
    const requestBody = demoFundsRequestBody(args.requestedReduction);
    postCalled = true;
    apiResponse = await bybitPost(config, DEMO_FUNDS_ENDPOINT, requestBody);
    const afterPayload = await bybitGet(config, '/v5/account/wallet-balance', {
      accountType: config.accountType
    });
    afterWallet = walletCoins(afterPayload);
  }

  const snapshot = {
    metadata: {
      track: 'Track B - Execution Laboratory',
      probe: 'bybit_demo_funds_probe',
      generatedAt,
      environment: config.environment,
      baseUrl: config.baseUrl,
      accountType: config.accountType,
      configSource: path.relative(REPO_ROOT, config.sourcePath),
      trackAInteraction: false,
      orderEndpointsCalled: false
    },
    mode: args.mode,
    requestedReduction: args.requestedReduction,
    targetUsdt: args.targetUsdt,
    confirmTargetReduction: args.confirmTargetReduction,
    plannedReduction,
    hardLimits: {
      defaultCoin: 'USDT',
      baselineCoins: BASELINE_COINS,
      maxTestReductionUsdt: MAX_REDUCTION_USDT,
      minTargetUsdt: MIN_TARGET_USDT,
      maxTargetUsdt: MAX_TARGET_USDT,
      adjustType: REDUCE_ADJUST_TYPE,
      baselineAddAdjustType: ADD_ADJUST_TYPE,
      onlyAddsUsdtWhenBelowBaseline: true
    },
    postCalled,
    beforeWallet,
    afterWallet,
    beforeState,
    finalState,
    plannedBaselineReductions,
    plannedBaselineAdditions,
    baselineTargets: args.baseline ? BASELINE_TARGETS : null,
    baselineClean: finalState ? isBaselineClean(finalState) : null,
    warnings,
    apiResponse
  };

  if (args.baseline) {
    baselineReportPaths = writeBaselineReport(snapshot);
    snapshot.baselineReportPaths = baselineReportPaths;
  }

  const outputPath = writeSnapshot(snapshot);
  printSummary(snapshot, outputPath);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab funds probe failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
