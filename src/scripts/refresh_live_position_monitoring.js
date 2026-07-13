const fs = require('fs');
const https = require('https');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber
} = require('./btc_deep_risk_utils');
const {
  fetchBybitAccountSync,
  mergeAccountSyncIntoRegister
} = require('./bybit_account_sync');
const { buildAccountingViews } = require('./live_accounting');
const { logCcwEnvStartup } = require('./ccw_env_diagnostics');

const LIVE_DIR = path.join(REPO_ROOT, 'live');
const LIVE_DATA_DIR = path.join(LIVE_DIR, 'data');
const POSITION_REGISTER_PATH = path.join(LIVE_DIR, 'position_register.json');
const OUTPUT_JSON = path.join(LIVE_DATA_DIR, 'live_position_monitoring.json');
const LIVE_METRICS_PATHS = {
  BTC: path.join(LIVE_DATA_DIR, 'btc_live_metrics.json'),
  ETH: path.join(LIVE_DATA_DIR, 'eth_live_metrics.json')
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function nyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const mapped = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${url}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchBybitOptionTicker(symbol) {
  const url = `https://api.bybit.com/v5/market/tickers?category=option&symbol=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  const row = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list[0]
    : null;
  return { endpoint: url, row };
}

async function fetchBybitLinearTicker(symbol) {
  const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  const row = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list[0]
    : null;
  return { endpoint: url, row };
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function normalizePosition(position) {
  const underlyingEntryTs = firstValue(position.underlying_entry_ts, position.underlying_entry_timestamp, position.opened_at);
  const optionEntryTs = firstValue(position.option_entry_ts, position.short_call_entry_ts, position.short_call_entry_timestamp, position.opened_at);
  const hedgeEntryTs = firstValue(position.hedge_entry_ts, position.hedge_entry_timestamp, position.opened_at);
  const optionEntryPremium = optionalNumber(position.option_entry_premium, position.short_call_entry_premium);
  return {
    ...position,
    position_status: firstValue(position.position_status, position.status),
    underlying_entry_price: optionalNumber(position.underlying_entry_price),
    underlying_entry_ts: underlyingEntryTs,
    underlying_entry_timestamp: underlyingEntryTs,
    short_call_symbol: firstValue(position.short_call_symbol, position.option_instrument),
    short_call_qty: optionalNumber(position.short_call_qty, position.option_qty),
    short_call_expiry: firstValue(position.short_call_expiry, position.option_expiry),
    short_call_strike: optionalNumber(position.short_call_strike, position.option_strike),
    short_call_entry_premium: optionEntryPremium,
    option_entry_premium: optionEntryPremium,
    option_entry_ts: optionEntryTs,
    short_call_entry_timestamp: optionEntryTs,
    hedge_entry_ts: hedgeEntryTs,
    hedge_entry_timestamp: hedgeEntryTs,
    cycle_accounting: position.cycle_accounting || null,
    accumulated_fees: optionalNumber(position.accumulated_fees)
  };
}

function optionMtmPnl(position, markPrice) {
  const entry = optionalNumber(position.short_call_entry_premium);
  const qty = optionalNumber(position.short_call_qty);
  const mark = optionalNumber(markPrice);
  if (entry === null || qty === null || mark === null) return null;
  return roundNumber((mark - entry) * qty);
}

function underlyingPnl(position, spotPrice) {
  const qty = optionalNumber(position.underlying_qty);
  const entry = optionalNumber(position.underlying_entry_price);
  const spot = optionalNumber(spotPrice);
  if (qty === null || entry === null || spot === null) return null;
  return roundNumber((spot - entry) * qty);
}

function underlyingMarketValue(position, spotPrice) {
  const qty = optionalNumber(position.underlying_qty);
  const spot = optionalNumber(spotPrice);
  if (qty === null || spot === null) return null;
  return roundNumber(qty * spot);
}

function hedgePnl(position, markPrice) {
  const qty = optionalNumber(position.hedge_qty);
  if (qty === 0) return 0;
  const entry = optionalNumber(position.hedge_entry_price);
  const mark = optionalNumber(markPrice);
  if (qty === null || entry === null || mark === null) return null;
  return roundNumber((mark - entry) * qty);
}

function sumIfComplete(...values) {
  if (values.some(value => optionalNumber(value) === null)) return null;
  return roundNumber(values.reduce((sum, value) => sum + optionalNumber(value), 0));
}

function normalizeTicker(row) {
  return {
    option_bid: optionalNumber(row && row.bid1Price, row && row.bidPrice),
    option_ask: optionalNumber(row && row.ask1Price, row && row.askPrice),
    option_mark_price: optionalNumber(row && row.markPrice),
    option_last_price: optionalNumber(row && row.lastPrice),
    implied_volatility: optionalNumber(row && row.markIv, row && row.bidIv, row && row.askIv),
    delta: optionalNumber(row && row.delta),
    gamma: optionalNumber(row && row.gamma),
    vega: optionalNumber(row && row.vega),
    theta: optionalNumber(row && row.theta)
  };
}

function loadPositionRegister() {
  if (!fs.existsSync(POSITION_REGISTER_PATH)) {
    throw new Error(`Missing Position Register: ${path.relative(REPO_ROOT, POSITION_REGISTER_PATH)}`);
  }
  return readJson(POSITION_REGISTER_PATH);
}

function activePositionsFromRegister(register) {
  const positions = Array.isArray(register.positions) ? register.positions : [];
  const active = positions
    .map(normalizePosition)
    .filter(position => String(position.position_status || '').toUpperCase() === 'ACTIVE');
  if (!active.length) {
    throw new Error('Position Register has no ACTIVE positions. Active monitoring requires a registered open cycle.');
  }
  return active;
}

async function loadSyncedRegister() {
  const register = loadPositionRegister();
  const accountSync = await fetchBybitAccountSync();
  if (!accountSync.available) {
    return { register, accountSync };
  }

  const syncedRegister = mergeAccountSyncIntoRegister(register, accountSync);
  fs.writeFileSync(POSITION_REGISTER_PATH, `${JSON.stringify(syncedRegister, null, 2)}\n`, 'utf8');
  return { register: syncedRegister, accountSync };
}

function loadCurrentSpot(asset, snapshotDate) {
  const metricsPath = LIVE_METRICS_PATHS[asset];
  if (!metricsPath || !fs.existsSync(metricsPath)) return { price: null, source: null };
  const payload = readJson(metricsPath);
  if (!payload || payload.snapshot_date !== snapshotDate) return { price: null, source: null };
  return {
    price: optionalNumber(payload.current_price),
    source: path.relative(REPO_ROOT, metricsPath)
  };
}

async function monitorPosition(position, snapshotDate, accountSync) {
  const warnings = [];
  const syncMeta = position.account_sync || null;
  const instrument = position.short_call_symbol;
  let tickerResult = { endpoint: null, row: null };
  let hedgeTickerResult = { endpoint: null, row: null };
  let ticker = {};
  const currentSpot = loadCurrentSpot(position.asset, snapshotDate);

  if (!instrument) {
    warnings.push('Registered short_call_symbol is missing.');
  } else {
    tickerResult = await fetchBybitOptionTicker(instrument);
    if (!tickerResult.row) warnings.push('Bybit public ticker did not return the registered option instrument.');
    ticker = normalizeTicker(tickerResult.row);
  }

  const hedgeInstrument = position.hedge_instrument || null;
  let hedgeMarkPrice = null;
  if (!hedgeInstrument) {
    warnings.push('Registered hedge_instrument is missing; hedge mark is N/A.');
  } else if (optionalNumber(position.hedge_qty) === null || optionalNumber(position.hedge_qty) === 0) {
    hedgeMarkPrice = null;
  } else {
    hedgeTickerResult = await fetchBybitLinearTicker(hedgeInstrument);
    hedgeMarkPrice = optionalNumber(hedgeTickerResult.row && hedgeTickerResult.row.markPrice);
    if (hedgeMarkPrice === null) warnings.push('Bybit public linear ticker did not return hedge mark price; hedge PnL is N/A.');
  }

  if (currentSpot.price === null) warnings.push('Current spot price is unavailable; underlying PnL is N/A.');
  if (optionalNumber(position.underlying_entry_price) === null) warnings.push('Underlying entry price unavailable; underlying and net PnL are not currently calculable.');
  if (optionalNumber(ticker.option_mark_price) === null) warnings.push('Option mark price is unavailable; option PnL is N/A.');
  if (accountSync && Array.isArray(accountSync.warnings)) warnings.push(...accountSync.warnings);
  if (accountSync && accountSync.available && syncMeta && !syncMeta.matched_option_position) warnings.push('Bybit account sync did not find the registered option position; preserving local option fields.');
  if (accountSync && accountSync.available && syncMeta && position.hedge_instrument && optionalNumber(position.hedge_qty) !== 0 && !syncMeta.matched_perpetual_position) warnings.push('Bybit account sync did not find the registered perpetual hedge; preserving local hedge fields.');

  const underlyingUnrealizedPnl = underlyingPnl(position, currentSpot.price);
  const underlyingValue = underlyingMarketValue(position, currentSpot.price);
  const optionUnrealizedPnl = optionMtmPnl(position, ticker.option_mark_price);
  const hedgeUnrealizedPnl = hedgePnl(position, hedgeMarkPrice);
  const accounting = buildAccountingViews({
    position,
    currentSpotPrice: currentSpot.price,
    optionMarkPrice: ticker.option_mark_price,
    hedgeMarkPrice
  });
  warnings.push(...accounting.accounting_warnings);
  const cycleAccounting = accounting.current_cycle_accounting;
  const portfolioAccounting = accounting.portfolio_lifetime_accounting;
  const legacyAccounting = accounting.legacy_accounting;

  return {
    asset: position.asset,
    cycle_id: position.cycle_id,
    data_as_of: snapshotDate,
    generated_at: new Date().toISOString(),
    monitoring_source: 'position_register_bybit_public_option_ticker',
    account_sync: accountSync ? {
      data_source: accountSync.metadata.data_source,
      last_sync: accountSync.metadata.last_sync,
      environment: accountSync.metadata.environment,
      base_url: accountSync.metadata.base_url,
      available: Boolean(accountSync.available),
      read_only: true,
      testnet: Boolean(accountSync.metadata.testnet),
      matched_spot: syncMeta ? Boolean(syncMeta.matched_spot) : false,
      matched_option_position: syncMeta ? Boolean(syncMeta.matched_option_position) : false,
      matched_perpetual_position: syncMeta ? Boolean(syncMeta.matched_perpetual_position) : false
    } : null,
    venue: 'Bybit',
    position_status: position.position_status || null,
    underlying_qty: optionalNumber(position.underlying_qty),
    underlying_entry_price: optionalNumber(position.underlying_entry_price),
    underlying_entry_timestamp: position.underlying_entry_timestamp || null,
    underlying_entry_ts: position.underlying_entry_ts || null,
    underlying_cost_basis: position.underlying_cost_basis || null,
    cycle_accounting: position.cycle_accounting || null,
    current_spot_price: roundNumber(currentSpot.price),
    underlying_market_value: underlyingValue,
    underlying_unrealized_pnl: legacyAccounting.underlying_unrealized_pnl,
    short_call_symbol: instrument || null,
    short_call_qty: optionalNumber(position.short_call_qty),
    short_call_expiry: position.short_call_expiry || null,
    short_call_strike: optionalNumber(position.short_call_strike),
    short_call_entry_premium: optionalNumber(position.short_call_entry_premium),
    short_call_entry_timestamp: position.short_call_entry_timestamp || null,
    option_instrument: instrument || null,
    option_expiry: position.short_call_expiry || null,
    days_to_expiration: position.short_call_expiry ? daysBetween(snapshotDate, position.short_call_expiry) : null,
    days_since_entry: position.short_call_entry_timestamp ? daysBetween(String(position.short_call_entry_timestamp).slice(0, 10), snapshotDate) : null,
    option_strike: optionalNumber(position.short_call_strike),
    option_qty: optionalNumber(position.short_call_qty),
    option_entry_premium: optionalNumber(position.short_call_entry_premium),
    premium_received: optionalNumber(position.short_call_entry_premium) === null || optionalNumber(position.short_call_qty) === null
      ? null
      : roundNumber(Math.abs(position.short_call_qty) * position.short_call_entry_premium),
    hedge_instrument: hedgeInstrument,
    hedge_qty: optionalNumber(position.hedge_qty),
    hedge_entry_price: optionalNumber(position.hedge_entry_price),
    hedge_entry_timestamp: position.hedge_entry_timestamp || null,
    hedge_cost_basis: position.hedge_cost_basis || null,
    hedge_mark_price: roundNumber(hedgeMarkPrice),
    hedge_unrealized_pnl_approx: legacyAccounting.hedge_unrealized_pnl_approx,
    accumulated_fees: optionalNumber(position.accumulated_fees),
    option_bid: roundNumber(ticker.option_bid),
    option_ask: roundNumber(ticker.option_ask),
    option_mark_price: roundNumber(ticker.option_mark_price),
    option_last_price: roundNumber(ticker.option_last_price),
    implied_volatility: roundNumber(ticker.implied_volatility),
    greeks: {
      delta: roundNumber(ticker.delta),
      gamma: roundNumber(ticker.gamma),
      vega: roundNumber(ticker.vega),
      theta: roundNumber(ticker.theta)
    },
    option_mtm_pnl: legacyAccounting.option_unrealized_pnl_approx,
    option_unrealized_pnl_approx: legacyAccounting.option_unrealized_pnl_approx,
    net_unrealized_pnl_approx: legacyAccounting.net_unrealized_pnl_approx,
    current_cycle_accounting: cycleAccounting,
    portfolio_lifetime_accounting: portfolioAccounting,
    legacy_accounting_note: legacyAccounting.note,
    cycle_underlying_pnl: cycleAccounting.underlying_pnl_since_cycle_open,
    cycle_option_pnl: cycleAccounting.option_pnl_current_cycle,
    cycle_hedge_pnl: cycleAccounting.hedge_pnl_current_cycle,
    net_cycle_pnl: cycleAccounting.net_cycle_pnl,
    net_cycle_pnl_pct: cycleAccounting.net_cycle_pnl_pct,
    cycle_capital_base: cycleAccounting.capital_base,
    portfolio_underlying_pnl: portfolioAccounting.underlying_pnl_since_original_spot_purchase,
    portfolio_option_pnl: portfolioAccounting.current_option_pnl,
    portfolio_hedge_pnl: portfolioAccounting.current_hedge_pnl,
    portfolio_net_pnl: portfolioAccounting.portfolio_net_pnl,
    portfolio_net_pnl_pct: portfolioAccounting.portfolio_net_pnl_pct,
    portfolio_capital_base: portfolioAccounting.capital_base,
    warnings,
    notes: position.notes || '',
    endpoints: {
      option_ticker: tickerResult.endpoint,
      hedge_ticker: hedgeTickerResult.endpoint
    },
    sources: {
      current_spot_price: currentSpot.source,
      option_mark_price: tickerResult.endpoint,
      hedge_mark_price: hedgeTickerResult.endpoint
    }
  };
}

async function main() {
  logCcwEnvStartup('refresh_live_position_monitoring.js');
  const snapshotDate = nyDate();
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  const { register, accountSync } = await loadSyncedRegister();
  const activePositions = activePositionsFromRegister(register);
  const rows = [];

  for (const position of activePositions) {
    const row = await monitorPosition(position, snapshotDate, accountSync);
    rows.push(row);
    console.log(`${row.asset}: monitored ${row.option_instrument || 'missing_option'} mark=${row.option_mark_price === null ? 'null' : row.option_mark_price}`);
  }

  const payload = {
    generated_at: new Date().toISOString(),
    data_as_of: snapshotDate,
    position_register: path.relative(REPO_ROOT, POSITION_REGISTER_PATH),
    account_sync: accountSync ? {
      ...accountSync.metadata,
      available: Boolean(accountSync.available),
      warnings: accountSync.warnings,
      wallet_balances: accountSync.wallet_balances,
      spot_holdings: accountSync.spot_holdings,
      perpetual_positions: accountSync.perpetual_positions,
      option_positions: accountSync.option_positions,
      executions: accountSync.executions,
      orders: accountSync.orders
    } : null,
    rows
  };
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error refreshing live position monitoring: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
