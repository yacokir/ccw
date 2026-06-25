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
const DEFAULT_CONFIG = {
  environment: 'demo',
  baseUrl: DEMO_BASE_URL,
  apiKey: '',
  apiSecret: '',
  recvWindow: 5000,
  accountType: 'UNIFIED',
  categories: ['spot', 'linear', 'option'],
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
    errors.push('Execution Lab Sprint 0C only allows environment="demo".');
  }
  if (config.baseUrl !== DEMO_BASE_URL) {
    errors.push(`Execution Lab Sprint 0C only allows baseUrl=${DEMO_BASE_URL}.`);
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

function bybitGet(config, pathname, params = {}) {
  const query = queryString(params);
  const timestamp = String(Date.now());
  const signature = signGetRequest(config, timestamp, query);
  const url = `${config.baseUrl}${pathname}${query ? `?${query}` : ''}`;
  const headers = {
    'X-BAPI-API-KEY': config.apiKey,
    'X-BAPI-SIGN': signature,
    'X-BAPI-SIGN-TYPE': '2',
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-RECV-WINDOW': config.recvWindow
  };

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
    request.end();
  });
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
      unrealisedPnl: roundNumber(position.unrealisedPnl)
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
    price: roundNumber(order.price),
    createdTime: order.createdTime || null,
    updatedTime: order.updatedTime || null
  }));
}

function openOrderParamsForCategory(category, limit) {
  if (category === 'linear') return { category, settleCoin: 'USDT', limit };
  if (category === 'option') return { category, settleCoin: 'USDT', limit };
  if (category === 'spot') return { category, limit };
  return null;
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function writeSnapshot(snapshot) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, `${timestampForFile()}_capital_snapshot.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function exposureFromPositions(positions) {
  return roundNumber((positions || []).reduce((sum, position) => {
    const value = optionalNumber(position.positionValue);
    return sum + (value === null ? 0 : Math.abs(value));
  }, 0));
}

function buildAccount(walletPayload, wallet, positions, openOrders) {
  const account = firstWalletAccount(walletPayload);
  const usdt = findCoin(wallet, 'USDT');
  const accountEquity = roundNumber(account.totalEquity !== undefined ? account.totalEquity : usdt && usdt.equity);
  const walletBalance = roundNumber(account.totalWalletBalance !== undefined ? account.totalWalletBalance : usdt && usdt.walletBalance);
  const availableBalance = roundNumber(account.totalAvailableBalance !== undefined ? account.totalAvailableBalance : usdt && usdt.free);
  const marginBalance = roundNumber(account.totalMarginBalance);
  const initialMargin = optionalNumber(account.totalInitialMargin);
  const maintenanceMargin = optionalNumber(account.totalMaintenanceMargin);

  return {
    accountEquity,
    walletBalance,
    availableBalance,
    marginBalance,
    usdtEquity: usdt ? usdt.equity : null,
    usdtWalletBalance: usdt ? usdt.walletBalance : null,
    usdtUsdValue: usdt ? usdt.usdValue : null,
    freeCollateral: availableBalance,
    marginInUse: initialMargin,
    maintenanceMargin: maintenanceMargin === null ? null : roundNumber(maintenanceMargin),
    positionsCount: positions.length,
    openOrdersCount: openOrders.length,
    collateral: {
      usdtCollateralSwitch: usdt ? usdt.collateralSwitch : null,
      usdtMarginCollateral: usdt ? usdt.marginCollateral : null
    },
    rawMarginFields: {
      totalInitialMargin: roundNumber(account.totalInitialMargin),
      totalMaintenanceMargin: roundNumber(account.totalMaintenanceMargin),
      totalPerpUPL: roundNumber(account.totalPerpUPL),
      accountIMRate: roundNumber(account.accountIMRate),
      accountMMRate: roundNumber(account.accountMMRate)
    }
  };
}

function printSummary(snapshot, outputPath) {
  console.log('Execution Laboratory Capital Snapshot');
  console.log(`Environment: ${snapshot.metadata.environment}`);
  console.log(`USDT equity: ${snapshot.account.usdtEquity === null ? 'unknown' : snapshot.account.usdtEquity}`);
  console.log(`USDT available: ${snapshot.account.usdtWalletBalance === null ? 'unknown' : snapshot.account.usdtWalletBalance}`);
  console.log(`Positions: ${snapshot.account.positionsCount}`);
  console.log(`Open orders: ${snapshot.account.openOrdersCount}`);
  console.log('Research conclusions: not determined');
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
    console.error('Execution Lab capital snapshot configuration error:');
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

  const accountInfo = await capture(
    'Account info',
    warnings,
    () => bybitGet(config, '/v5/account/info'),
    null
  );

  const positions = [];
  const openOrders = [];
  for (const category of config.categories || []) {
    if (category === 'linear') {
      const payload = await capture(
        'Linear positions',
        warnings,
        () => bybitGet(config, '/v5/position/list', { category, settleCoin: 'USDT' }),
        null
      );
      positions.push(...nonZeroPositions(payload, category));
    }

    if (category === 'option') {
      const payload = await capture(
        'Option positions',
        warnings,
        () => bybitGet(config, '/v5/position/list', { category, settleCoin: 'USDT' }),
        null
      );
      positions.push(...nonZeroPositions(payload, category));
    }

    const orderParams = openOrderParamsForCategory(category, config.openOrderLimit);
    if (orderParams) {
      const payload = await capture(
        `${category} open orders`,
        warnings,
        () => bybitGet(config, '/v5/order/realtime', orderParams),
        null
      );
      openOrders.push(...compactOrders(payload, category));
    } else {
      warnings.push(`${category} open orders skipped: unsupported execution lab category.`);
    }
  }

  const account = buildAccount(walletPayload, wallet, positions, openOrders);
  const executedExposure = exposureFromPositions(positions);
  const strategyAllocatedCapital = account.usdtEquity;
  const capitalInUse = account.marginInUse;
  const capitalAvailable = account.usdtWalletBalance;

  const snapshot = {
    metadata: {
      track: 'Track B - Execution Laboratory',
      probe: 'bybit_capital_snapshot',
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
    strategyCapitalModel: {
      strategyAllocatedCapital,
      capitalInUse,
      capitalAvailable,
      intendedExposure: 0,
      executedExposure,
      unreconciledExposure: roundNumber(executedExposure - 0)
    },
    research: {
      minimumTheoreticalCapital: null,
      minimumOperationalCapital: null,
      recommendedCapital: null,
      comfortableCapital: null,
      conclusion: 'not determined'
    },
    wallet,
    positions,
    openOrders,
    accountInfo,
    warnings
  };

  const outputPath = writeSnapshot(snapshot);
  printSummary(snapshot, outputPath);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab capital snapshot failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
