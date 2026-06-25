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
const ALLOWED_METHOD = 'GET';
const DEFAULT_CONFIG = {
  environment: 'demo',
  baseUrl: DEMO_BASE_URL,
  apiKey: '',
  apiSecret: '',
  recvWindow: 5000,
  accountType: 'UNIFIED',
  categories: ['spot', 'linear', 'option'],
  recentFillLimit: 20,
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
    errors.push('Execution Lab Sprint 0A only allows environment="demo".');
  }
  if (config.baseUrl !== DEMO_BASE_URL) {
    errors.push(`Execution Lab Sprint 0A only allows baseUrl=${DEMO_BASE_URL}.`);
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
    const request = https.request(url, { method: ALLOWED_METHOD, headers }, response => {
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

function nonZeroPositions(payload, category) {
  return resultList(payload)
    .filter(position => Number(position.size || 0) !== 0)
    .map(position => ({
      category,
      symbol: position.symbol || null,
      side: position.side || null,
      size: position.size || null,
      avgPrice: position.avgPrice || null,
      markPrice: position.markPrice || null,
      unrealisedPnl: position.unrealisedPnl || null
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
    qty: order.qty || null,
    price: order.price || null,
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
    side: fill.side || null,
    execPrice: fill.execPrice || null,
    execQty: fill.execQty || null,
    execFee: fill.execFee || null,
    execTime: fill.execTime || null
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
  const filePath = path.join(OUTPUT_DIR, `${timestampForFile()}_bybit_demo_readonly_probe.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return filePath;
}

function printSummary(snapshot, outputPath) {
  console.log('Execution Lab Bybit demo read-only probe');
  console.log(`Environment: ${snapshot.metadata.environment}`);
  console.log(`Base URL: ${snapshot.metadata.baseUrl}`);
  console.log(`Wallet coins: ${snapshot.summary.walletCoinCount}`);
  console.log(`Non-zero positions: ${snapshot.summary.nonZeroPositionCount}`);
  console.log(`Open orders: ${snapshot.summary.openOrderCount}`);
  console.log(`Recent fills: ${snapshot.summary.recentFillCount}`);
  console.log(`Warnings: ${snapshot.warnings.length}`);
  if (snapshot.warnings.length) {
    for (const warning of snapshot.warnings) console.log(`- ${warning}`);
  }
  console.log(`Snapshot: ${outputPath}`);
}

async function main() {
  const config = loadConfig();
  const configErrors = validateConfig(config);
  if (configErrors.length) {
    console.error('Execution Lab probe configuration error:');
    for (const error of configErrors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  const warnings = [];
  const generatedAt = new Date().toISOString();

  const walletPayload = await capture(
    'Wallet balances',
    warnings,
    () => bybitGet(config, '/v5/account/wallet-balance', { accountType: config.accountType }),
    null
  );

  const positions = [];
  const openOrders = [];
  const recentFills = [];
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

    const openOrderParams = openOrderParamsForCategory(category, config.openOrderLimit);
    if (openOrderParams) {
      const orderPayload = await capture(
        `${category} open orders`,
        warnings,
        () => bybitGet(config, '/v5/order/realtime', openOrderParams),
        null
      );
      openOrders.push(...compactOrders(orderPayload, category));
    } else {
      warnings.push(`${category} open orders skipped: unsupported execution lab category.`);
    }

    const fillsPayload = await capture(
      `${category} recent fills`,
      warnings,
      () => bybitGet(config, '/v5/execution/list', { category, limit: config.recentFillLimit }),
      null
    );
    recentFills.push(...compactFills(fillsPayload, category));
  }

  const wallet = walletCoins(walletPayload);
  const snapshot = {
    metadata: {
      track: 'Track B - Execution Laboratory',
      probe: 'bybit_demo_readonly_probe',
      generatedAt,
      environment: config.environment,
      baseUrl: config.baseUrl,
      accountType: config.accountType,
      readOnly: true,
      tradingRequestsSent: false,
      trackAInteraction: false,
      configSource: path.relative(REPO_ROOT, config.sourcePath)
    },
    summary: {
      walletCoinCount: wallet.length,
      nonZeroPositionCount: positions.length,
      openOrderCount: openOrders.length,
      recentFillCount: recentFills.length
    },
    warnings,
    wallet,
    positions,
    openOrders,
    recentFills
  };

  const outputPath = writeSnapshot(snapshot);
  printSummary(snapshot, outputPath);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Execution Lab probe failed: ${error.message || String(error)}`);
    process.exitCode = 1;
  });
}
