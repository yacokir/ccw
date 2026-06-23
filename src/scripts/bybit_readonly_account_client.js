const crypto = require('crypto');
const https = require('https');
const { loadLocalEnv } = require('./load_local_env');

loadLocalEnv();

const BYBIT_PROD_BASE_URL = 'https://api.bybit.com';
const BYBIT_DEMO_BASE_URL = 'https://api-demo.bybit.com';
const BYBIT_TESTNET_BASE_URL = 'https://api-testnet.bybit.com';
const DEFAULT_RECV_WINDOW = '5000';

function hasCredentials(env = process.env) {
  return Boolean(env.BYBIT_API_KEY && env.BYBIT_API_SECRET);
}

function normalizeBybitEnv(env = process.env) {
  const explicit = String(env.BYBIT_ENV || '').trim().toLowerCase();
  if (explicit) {
    if (['mainnet', 'demo', 'testnet'].includes(explicit)) return explicit;
    return 'mainnet';
  }
  return String(env.BYBIT_TESTNET || 'false').toLowerCase() === 'true' ? 'testnet' : 'mainnet';
}

function baseUrlForEnv(environment) {
  if (environment === 'demo') return BYBIT_DEMO_BASE_URL;
  if (environment === 'testnet') return BYBIT_TESTNET_BASE_URL;
  return BYBIT_PROD_BASE_URL;
}

function bybitConfigFromEnv(env = process.env) {
  const environment = normalizeBybitEnv(env);
  return {
    apiKey: env.BYBIT_API_KEY || '',
    apiSecret: env.BYBIT_API_SECRET || '',
    environment,
    testnet: environment === 'testnet',
    baseUrl: env.BYBIT_BASE_URL || baseUrlForEnv(environment),
    recvWindow: env.BYBIT_RECV_WINDOW || DEFAULT_RECV_WINDOW,
    diagnostics: String(env.BYBIT_ACCOUNT_DIAGNOSTICS || 'false').toLowerCase() === 'true'
  };
}

function queryString(params) {
  return Object.entries(params || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function signRequest(config, timestamp, query) {
  const payload = `${timestamp}${config.apiKey}${config.recvWindow}${query}`;
  return crypto
    .createHmac('sha256', config.apiSecret)
    .update(payload)
    .digest('hex');
}

function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.length <= 6) return '*'.repeat(apiKey.length);
  return `${apiKey.slice(0, 6)}${'*'.repeat(Math.max(4, apiKey.length - 6))}`;
}

function diagnosticLog(config, request, response = {}) {
  if (!config.diagnostics) return;
  const category = request.params && request.params.category ? request.params.category : null;
  const retCode = response.payload && response.payload.retCode !== undefined ? response.payload.retCode : null;
  const retMsg = response.payload && response.payload.retMsg !== undefined ? response.payload.retMsg : null;
  console.warn(`[bybit-account-diagnostic] ${JSON.stringify({
    environment: config.environment,
    base_url: config.baseUrl,
    endpoint_path: request.pathname,
    query_string: request.query,
    category,
    timestamp: request.timestamp,
    recv_window: config.recvWindow,
    api_key: maskApiKey(config.apiKey),
    http_status: response.statusCode || null,
    retCode,
    retMsg
  })}`);
}

function getJson(url, headers, diagnosticContext) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, response => {
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
          diagnosticLog(diagnosticContext.config, diagnosticContext.request, { statusCode: response.statusCode, payload: null });
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
          return;
        }
        diagnosticLog(diagnosticContext.config, diagnosticContext.request, { statusCode: response.statusCode, payload });
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const ret = payload && payload.retCode !== undefined ? ` retCode ${payload.retCode}: ${payload.retMsg || 'unknown error'}` : '';
          reject(new Error(`HTTP ${response.statusCode}${ret} from ${url}: ${body.slice(0, 200)}`));
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
  });
}

class BybitReadOnlyAccountClient {
  constructor(config = bybitConfigFromEnv()) {
    this.config = config;
  }

  async get(pathname, params = {}) {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('Missing BYBIT_API_KEY or BYBIT_API_SECRET.');
    }
    const query = queryString(params);
    const timestamp = String(Date.now());
    const signature = signRequest(this.config, timestamp, query);
    const url = `${this.config.baseUrl}${pathname}${query ? `?${query}` : ''}`;
    return getJson(url, {
      'X-BAPI-API-KEY': this.config.apiKey,
      'X-BAPI-SIGN': signature,
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': this.config.recvWindow
    }, {
      config: this.config,
      request: { pathname, params, query, timestamp }
    });
  }

  async walletBalance(accountType = 'UNIFIED') {
    return this.get('/v5/account/wallet-balance', { accountType });
  }

  async positions(category, params = {}) {
    return this.get('/v5/position/list', { category, ...params });
  }

  async executions(category, params = {}) {
    return this.get('/v5/execution/list', { category, limit: 50, ...params });
  }

  async orderHistory(category, params = {}) {
    return this.get('/v5/order/history', { category, limit: 50, ...params });
  }
}

module.exports = {
  BybitReadOnlyAccountClient,
  bybitConfigFromEnv,
  hasCredentials,
  maskApiKey
};
