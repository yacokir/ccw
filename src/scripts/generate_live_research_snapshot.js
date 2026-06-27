const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  readCsv,
  readJson,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  sampleStdDev
} = require('./btc_deep_risk_utils');
const { buildAccountingViews } = require('./live_accounting');
const { logCcwEnvStartup } = require('./ccw_env_diagnostics');

const LIVE_DIR = path.join(REPO_ROOT, 'live');
const SNAPSHOT_DIR = path.join(LIVE_DIR, 'snapshots');
const REPORTS_DIR = path.join(LIVE_DIR, 'reports');
const ACTIVE_DAILY_REPORT_PATH = path.join(LIVE_DIR, 'ACTIVE_MONITORING_DAILY.md');
const ACTIVE_DAILY_REPORT_HTML_PATH = path.join(REPORTS_DIR, 'ACTIVE_MONITORING_DAILY.html');
const LIVE_POSITION_TIMELINE_PATH = path.join(LIVE_DIR, 'LIVE_POSITION_TIMELINE.md');
const LIVE_POSITION_TIMELINE_HTML_PATH = path.join(REPORTS_DIR, 'LIVE_POSITION_TIMELINE.html');
const LIVE_POSITION_TIMELINE_CSV_PATH = path.join(LIVE_DIR, 'LIVE_POSITION_TIMELINE.csv');
const LIVE_MONITORING_SIGNALS_PATH = path.join(LIVE_DIR, 'data', 'live_monitoring_signals.json');
const LIVE_OPTION_DISCOVERY_PATH = path.join(LIVE_DIR, 'data', 'live_option_discovery.json');
const POSITION_REGISTER_PATH = path.join(LIVE_DIR, 'position_register.json');
const LIVE_POSITION_MONITORING_PATH = path.join(LIVE_DIR, 'data', 'live_position_monitoring.json');

const DEFAULTS = {
  mode: 'daily',
  decisionTime: '10:00',
  timezone: 'America/New_York',
  venue: 'Bybit',
  btcCurrentHedge: 0,
  ethCurrentHedge: 0,
  btcNormalCounter: 0,
  ethNormalCounter: 0
};

const HEDGE_BY_STATE = {
  normal: 0,
  watch: 0,
  stress: 30,
  crisis: 40
};

const TRADING_DAYS_PER_YEAR_CRYPTO = 365;
const HISTORICAL_VAR_EXPECTED_TAIL_DAYS = 20;

const ASSETS = [
  {
    asset: 'BTC',
    currentHedgeArg: 'btcCurrentHedge',
    normalCounterArg: 'btcNormalCounter',
    dailyMtmPaths: [
      path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020', 'btc_weekly_otm05_2020_daily_mtm.json'),
      path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021', 'btc_weekly_otm05_2021_daily_mtm.json'),
      path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022', 'btc_weekly_otm05_2022_daily_mtm.json'),
      path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023', 'btc_weekly_otm05_2023_daily_mtm.json'),
      path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024', 'btc_weekly_otm05_2024_daily_mtm.json'),
      path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')
    ],
    signalPath: path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv'),
    liveMetricsPath: path.join(LIVE_DIR, 'data', 'btc_live_metrics.json')
  },
  {
    asset: 'ETH',
    currentHedgeArg: 'ethCurrentHedge',
    normalCounterArg: 'ethNormalCounter',
    dailyMtmPaths: [
      path.join(OUTPUT_DIR, 'daily_mtm', 'eth_weekly_otm05_2025', 'eth_weekly_otm05_2025_daily_mtm.json')
    ],
    signalPath: path.join(OUTPUT_DIR, 'daily_mtm', 'eth_hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv'),
    liveMetricsPath: path.join(LIVE_DIR, 'data', 'eth_live_metrics.json')
  }
];

const MANUAL_LOG_COLUMNS = [
  'date',
  'decision_timestamp',
  'asset',
  'spot_price',
  'option_strike',
  'expiry',
  'premium',
  'damage_state',
  'alert_state',
  'portfolio_state',
  'current_hedge',
  'target_hedge',
  'executed_delta',
  'resulting_hedge',
  'normal_counter',
  'circuit_breaker_status',
  'comments'
];

function parseArgs(argv) {
  return argv.reduce((args, raw) => {
    if (!raw.startsWith('--')) return args;
    const [key, value = 'true'] = raw.slice(2).split('=');
    args[key] = value;
    return args;
  }, { ...DEFAULTS });
}

function assertArgs(args) {
  if (!['t0', 'daily', 'manual'].includes(args.mode)) {
    throw new Error(`Invalid --mode=${args.mode}. Expected --mode=t0, --mode=daily, or --mode=manual.`);
  }
  if (!/^\d{2}:\d{2}$/.test(args.decisionTime)) {
    throw new Error(`Invalid --decisionTime=${args.decisionTime}. Expected HH:MM.`);
  }
}

function datePartsInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function localDateString(date, timezone) {
  const parts = datePartsInTimezone(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function decisionTimestamp(date, args) {
  const parts = datePartsInTimezone(date, args.timezone);
  return `${parts.year}-${parts.month}-${parts.day} ${args.decisionTime} ${args.timezone}`;
}

function localTimestamp(date, timezone) {
  const parts = datePartsInTimezone(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${timezone}`;
}

function localTimeCompact(date, timezone) {
  const parts = datePartsInTimezone(date, timezone);
  return `${parts.hour}${parts.minute}`;
}

function loadDailyRows(assetConfig) {
  const rows = [];
  const sources = [];

  for (const filePath of assetConfig.dailyMtmPaths) {
    if (!fs.existsSync(filePath)) continue;
    const payload = readJson(filePath);
    sources.push(path.relative(REPO_ROOT, filePath));
    for (const row of payload.rows || []) {
      rows.push({ ...row, source_file: path.relative(REPO_ROOT, filePath) });
    }
  }

  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { rows, sources };
}

function loadSignals(assetConfig) {
  if (!assetConfig.signalPath || !fs.existsSync(assetConfig.signalPath)) {
    return { signals: new Map(), source: null };
  }
  const signals = new Map();
  for (const row of readCsv(assetConfig.signalPath)) {
    signals.set(row.date, row);
  }
  return { signals, source: path.relative(REPO_ROOT, assetConfig.signalPath) };
}

function loadCurrentLiveMetrics(assetConfig, snapshotDate) {
  if (!assetConfig.liveMetricsPath || !fs.existsSync(assetConfig.liveMetricsPath)) return null;
  const payload = readJson(assetConfig.liveMetricsPath);
  return payload && payload.snapshot_date === snapshotDate ? payload : null;
}

function loadLiveMonitoringSignals(snapshotDate) {
  if (!fs.existsSync(LIVE_MONITORING_SIGNALS_PATH)) return new Map();
  const payload = readJson(LIVE_MONITORING_SIGNALS_PATH);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return new Map(rows
    .filter(row => row.asset && row.data_as_of === snapshotDate)
    .map(row => [row.asset, row]));
}

function loadLiveOptionDiscovery(snapshotDate) {
  if (!fs.existsSync(LIVE_OPTION_DISCOVERY_PATH)) return new Map();
  const payload = readJson(LIVE_OPTION_DISCOVERY_PATH);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return new Map(rows
    .filter(row => row.asset && row.data_as_of === snapshotDate)
    .map(row => [row.asset, row]));
}

function loadActivePositionRegister() {
  if (!fs.existsSync(POSITION_REGISTER_PATH)) {
    return { positions: new Map(), source: null, missing: true };
  }
  const payload = readJson(POSITION_REGISTER_PATH);
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const active = positions
    .map(normalizePositionRegisterRow)
    .filter(position => String(position.position_status || '').toUpperCase() === 'ACTIVE');
  return {
    positions: new Map(active.filter(position => position.asset).map(position => [position.asset, position])),
    source: path.relative(REPO_ROOT, POSITION_REGISTER_PATH),
    missing: false
  };
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function normalizePositionRegisterRow(position) {
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

function loadLivePositionMonitoring(snapshotDate) {
  if (!fs.existsSync(LIVE_POSITION_MONITORING_PATH)) return { rows: new Map(), accountSync: null };
  const payload = readJson(LIVE_POSITION_MONITORING_PATH);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return {
    rows: new Map(rows
      .filter(row => row.asset && row.data_as_of === snapshotDate)
      .map(row => [row.asset, row])),
    accountSync: payload.account_sync || null
  };
}

function latestRowOnOrBefore(rows, date) {
  const candidates = rows.filter(row => row.date && row.date <= date);
  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1];
}

function rowDaysBefore(rows, date, days) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  target.setUTCDate(target.getUTCDate() - days);
  const targetDate = target.toISOString().slice(0, 10);
  return latestRowOnOrBefore(rows, targetDate);
}

function spotReturnPct(currentRow, priorRow) {
  const current = optionalNumber(currentRow && currentRow.underlying_price);
  const prior = optionalNumber(priorRow && priorRow.underlying_price);
  if (current === null || prior === null || prior === 0) return null;
  return roundNumber((current / prior - 1) * 100);
}

function realizedVol30d(rows, date) {
  const current = latestRowOnOrBefore(rows, date);
  if (!current) return null;

  const start = new Date(`${current.date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 30);
  const startDate = start.toISOString().slice(0, 10);
  const windowRows = rows.filter(row => row.date >= startDate && row.date <= current.date);
  const returns = [];

  for (let i = 1; i < windowRows.length; i++) {
    const prev = optionalNumber(windowRows[i - 1].underlying_price);
    const next = optionalNumber(windowRows[i].underlying_price);
    if (prev !== null && next !== null && prev !== 0) {
      returns.push((next / prev - 1) * 100);
    }
  }

  return roundNumber(sampleStdDev(returns));
}

function annualizeDailyVolPct(value) {
  const daily = optionalNumber(value);
  if (daily === null) return null;
  return roundNumber(daily * Math.sqrt(TRADING_DAYS_PER_YEAR_CRYPTO));
}

function executionStateFor(targetHedgePct) {
  const target = optionalNumber(targetHedgePct);
  if (target === 0) return 'NO_HEDGE';
  if (target === 30) return 'HEDGE_30';
  if (target === 40) return 'HEDGE_40';
  return 'CUSTOM_HEDGE';
}

function todayActionFor(asset, targetHedgePct, deltaPct) {
  const target = optionalNumber(targetHedgePct);
  const delta = optionalNumber(deltaPct);
  const symbol = `${asset}USDT`;
  if (target === null || delta === null) return '';
  if (target === 0 && delta === 0) return 'NO ACTION';
  if (target === 0 && delta < 0) return 'CLOSE HEDGE';
  if (delta > 0) return `SELL ${symbol} PERP (${formatHedgePct(delta)} of spot exposure)`;
  if (delta < 0) return `REDUCE HEDGE TO ${formatHedgePct(target)}`;
  return 'NO ACTION';
}

function premiumStatusFor(source, premium) {
  if (optionalNumber(premium) === null) return 'UNAVAILABLE';
  const rawSource = String(source || '').toLowerCase();
  if (rawSource.includes('deribit') || rawSource.includes('fallback')) return 'INDICATIVE_DERIBIT';
  if (rawSource.includes('bybit')) return 'EXECUTABLE_BYBIT';
  return 'UNAVAILABLE';
}

function staleWarning(sourceDate, snapshotDate) {
  if (!sourceDate || sourceDate === snapshotDate) return null;
  return {
    data_as_of: sourceDate,
    snapshot_date: snapshotDate,
    message: 'Metrics are based on stale source data. Trade recommendations may be blocked by circuit breakers.'
  };
}

function parseInstrument(instrumentName) {
  if (!instrumentName) return { expiry: null, strike: null };
  const parts = String(instrumentName).split('-');
  if (parts.length < 4) return { expiry: null, strike: null };
  return {
    expiry: parts[1],
    strike: optionalNumber(parts[2])
  };
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function sumIfComplete(...values) {
  if (values.some(value => optionalNumber(value) === null)) return null;
  return roundNumber(values.reduce((sum, value) => sum + optionalNumber(value), 0));
}

function accountingFields(positionRow, positionMonitoringRow, spotPrice, snapshotDate) {
  const warnings = [];
  const currentSpotPrice = optionalNumber(positionMonitoringRow && positionMonitoringRow.current_spot_price, spotPrice);
  const underlyingQty = optionalNumber(positionRow && positionRow.underlying_qty);
  const underlyingEntryPrice = optionalNumber(positionRow && positionRow.underlying_entry_price);
  const shortCallQty = optionalNumber(positionRow && positionRow.short_call_qty, positionRow && positionRow.option_qty);
  const shortCallEntryPremium = optionalNumber(positionRow && positionRow.short_call_entry_premium, positionRow && positionRow.option_entry_premium);
  const optionMarkPrice = optionalNumber(positionMonitoringRow && positionMonitoringRow.option_mark_price);
  const hedgeQty = optionalNumber(positionRow && positionRow.hedge_qty);
  const hedgeEntryPrice = optionalNumber(positionRow && positionRow.hedge_entry_price);
  const hedgeMarkPrice = optionalNumber(positionMonitoringRow && positionMonitoringRow.hedge_mark_price);
  const underlyingMarketValue = underlyingQty === null || currentSpotPrice === null
    ? null
    : roundNumber(underlyingQty * currentSpotPrice);
  const underlyingUnrealizedPnl = underlyingQty === null || underlyingEntryPrice === null || currentSpotPrice === null
    ? null
    : roundNumber((currentSpotPrice - underlyingEntryPrice) * underlyingQty);
  const optionUnrealizedPnl = shortCallQty === null || shortCallEntryPremium === null || optionMarkPrice === null
    ? null
    : roundNumber((optionMarkPrice - shortCallEntryPremium) * shortCallQty);
  const hedgeUnrealizedPnl = hedgeQty === null || hedgeEntryPrice === null || hedgeMarkPrice === null
    ? null
    : roundNumber((hedgeMarkPrice - hedgeEntryPrice) * hedgeQty);
  const accountingViews = positionRow
    ? buildAccountingViews({
      position: positionRow,
      currentSpotPrice,
      optionMarkPrice,
      hedgeMarkPrice
    })
    : {
      current_cycle_accounting: null,
      portfolio_lifetime_accounting: null,
      legacy_accounting: {
        underlying_unrealized_pnl: underlyingUnrealizedPnl,
        option_unrealized_pnl_approx: optionUnrealizedPnl,
        hedge_unrealized_pnl_approx: hedgeUnrealizedPnl,
        net_unrealized_pnl_approx: sumIfComplete(underlyingUnrealizedPnl, optionUnrealizedPnl, hedgeUnrealizedPnl),
        note: null
      },
      accounting_warnings: []
    };

  if (underlyingEntryPrice === null) warnings.push('Underlying entry price unavailable; underlying and net PnL are not currently calculable.');
  if (underlyingQty === null) warnings.push('Underlying quantity unavailable; underlying and net PnL are not currently calculable.');
  if (positionRow && !positionRow.underlying_entry_timestamp) warnings.push('Underlying entry timestamp unavailable; days since entry may be unavailable.');
  if (optionMarkPrice === null) warnings.push('Option mark price is unavailable; option unrealized PnL is N/A.');
  if (hedgeQty !== null && hedgeQty !== 0 && hedgeMarkPrice === null) warnings.push('Hedge mark price is unavailable; hedge unrealized PnL is N/A.');

  const entryTimestamp = firstValue(positionRow && positionRow.short_call_entry_timestamp, positionRow && positionRow.underlying_entry_timestamp);
  const expiry = firstValue(positionRow && positionRow.short_call_expiry, positionRow && positionRow.option_expiry);

  return {
    current_spot_price: roundNumber(currentSpotPrice),
    underlying_entry_price: underlyingEntryPrice,
    underlying_entry_timestamp: positionRow ? positionRow.underlying_entry_timestamp || null : null,
    underlying_entry_ts: positionRow ? positionRow.underlying_entry_ts || null : null,
    underlying_cost_basis: positionRow ? positionRow.underlying_cost_basis || null : null,
    underlying_market_value: underlyingMarketValue,
    cycle_accounting: positionRow ? positionRow.cycle_accounting || null : null,
    underlying_unrealized_pnl: accountingViews.legacy_accounting.underlying_unrealized_pnl,
    premium_received: shortCallQty === null || shortCallEntryPremium === null ? null : roundNumber(Math.abs(shortCallQty) * shortCallEntryPremium),
    short_call_symbol: positionRow ? firstValue(positionRow.short_call_symbol, positionRow.option_instrument) : null,
    short_call_qty: shortCallQty,
    short_call_expiry: expiry,
    short_call_strike: optionalNumber(positionRow && positionRow.short_call_strike, positionRow && positionRow.option_strike),
    short_call_entry_premium: shortCallEntryPremium,
    short_call_entry_timestamp: positionRow ? positionRow.short_call_entry_timestamp || null : null,
    option_mark_price: roundNumber(optionMarkPrice),
    option_unrealized_pnl_approx: accountingViews.legacy_accounting.option_unrealized_pnl_approx,
    hedge_entry_timestamp: positionRow ? positionRow.hedge_entry_timestamp || null : null,
    hedge_cost_basis: positionRow ? positionRow.hedge_cost_basis || null : null,
    hedge_mark_price: roundNumber(hedgeMarkPrice),
    hedge_unrealized_pnl_approx: accountingViews.legacy_accounting.hedge_unrealized_pnl_approx,
    accumulated_fees: optionalNumber(positionRow && positionRow.accumulated_fees),
    net_unrealized_pnl_approx: accountingViews.legacy_accounting.net_unrealized_pnl_approx,
    current_cycle_accounting: accountingViews.current_cycle_accounting,
    portfolio_lifetime_accounting: accountingViews.portfolio_lifetime_accounting,
    legacy_accounting_note: accountingViews.legacy_accounting.note,
    cycle_underlying_pnl: accountingViews.current_cycle_accounting && accountingViews.current_cycle_accounting.underlying_pnl_since_cycle_open,
    cycle_option_pnl: accountingViews.current_cycle_accounting && accountingViews.current_cycle_accounting.option_pnl_current_cycle,
    cycle_hedge_pnl: accountingViews.current_cycle_accounting && accountingViews.current_cycle_accounting.hedge_pnl_current_cycle,
    net_cycle_pnl: accountingViews.current_cycle_accounting && accountingViews.current_cycle_accounting.net_cycle_pnl,
    net_cycle_pnl_pct: accountingViews.current_cycle_accounting && accountingViews.current_cycle_accounting.net_cycle_pnl_pct,
    cycle_capital_base: accountingViews.current_cycle_accounting && accountingViews.current_cycle_accounting.capital_base,
    portfolio_underlying_pnl: accountingViews.portfolio_lifetime_accounting && accountingViews.portfolio_lifetime_accounting.underlying_pnl_since_original_spot_purchase,
    portfolio_option_pnl: accountingViews.portfolio_lifetime_accounting && accountingViews.portfolio_lifetime_accounting.current_option_pnl,
    portfolio_hedge_pnl: accountingViews.portfolio_lifetime_accounting && accountingViews.portfolio_lifetime_accounting.current_hedge_pnl,
    portfolio_net_pnl: accountingViews.portfolio_lifetime_accounting && accountingViews.portfolio_lifetime_accounting.portfolio_net_pnl,
    portfolio_net_pnl_pct: accountingViews.portfolio_lifetime_accounting && accountingViews.portfolio_lifetime_accounting.portfolio_net_pnl_pct,
    portfolio_capital_base: accountingViews.portfolio_lifetime_accounting && accountingViews.portfolio_lifetime_accounting.capital_base,
    days_since_entry: entryTimestamp ? daysBetween(String(entryTimestamp).slice(0, 10), snapshotDate) : null,
    days_to_expiry: expiry ? daysBetween(snapshotDate, expiry) : null,
    accounting_warnings: dedupeWarnings([...warnings, ...accountingViews.accounting_warnings])
  };
}

function normalizeWarningText(warning) {
  const raw = String(warning || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;
  if (lower.includes('underlying entry price') && (lower.includes('unavailable') || lower.includes('missing'))) {
    return 'Underlying entry price unavailable; underlying and net PnL are not currently calculable.';
  }
  if (lower.includes('underlying quantity') && (lower.includes('unavailable') || lower.includes('missing'))) {
    return 'Underlying quantity unavailable; underlying and net PnL are not currently calculable.';
  }
  if (lower.includes('underlying entry timestamp') && (lower.includes('unavailable') || lower.includes('missing'))) {
    return 'Underlying entry timestamp unavailable; days since entry may be unavailable.';
  }
  return raw;
}

function dedupeWarnings(warnings) {
  const normalized = [];
  const seen = new Set();
  for (const warning of warnings || []) {
    const value = normalizeWarningText(warning);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function isStale(sourceDate, snapshotDate) {
  return !sourceDate || sourceDate !== snapshotDate;
}

function baseTargetForState(alertState) {
  return HEDGE_BY_STATE[alertState] ?? 0;
}

function applyHysteresis(alertState, baseTarget, currentHedge, normalCounter) {
  const current = optionalNumber(currentHedge) ?? 0;
  const counter = optionalNumber(normalCounter) ?? 0;

  if (alertState === 'normal') {
    const nextCounter = counter + 1;
    const target = nextCounter >= 2 ? 0 : current;
    return {
      targetHedge: target,
      resultingNormalCounter: nextCounter,
      hysteresisNote: nextCounter >= 2
        ? 'normal_confirmed_close_allowed'
        : 'normal_pending_second_confirmation'
    };
  }

  if (alertState === 'stress' || alertState === 'crisis') {
    return {
      targetHedge: baseTarget,
      resultingNormalCounter: 0,
      hysteresisNote: 'risk_state_executes_immediately'
    };
  }

  return {
    targetHedge: current,
    resultingNormalCounter: counter,
    hysteresisNote: alertState === 'watch' ? 'watch_maps_to_no_hedge' : 'no_trade_state'
  };
}

function circuitBreakers(fields) {
  const reasons = [];
  if (!fields.dailyRow) reasons.push('Daily MTM unavailable');
  if (fields.stale) reasons.push('Daily MTM stale or not current decision date');
  if (!fields.signalRow) reasons.push('Monitoring indicators unavailable');
  if (fields.signalStale) reasons.push('Monitoring indicators stale');
  if (optionalNumber(fields.spotPrice) === null) reasons.push('Spot price unavailable');
  if (optionalNumber(fields.ewma) === null) reasons.push('EWMA unavailable');
  if (optionalNumber(fields.historicalVaR) === null) reasons.push('Historical VaR unavailable');
  if (!fields.optionExpiry || optionalNumber(fields.optionStrike) === null) reasons.push('Option expiry or strike unavailable');
  if (fields.monitoringMode && !fields.positionRow) reasons.push('Active Position Register entry unavailable');
  if (fields.monitoringMode && fields.positionMonitoringStale) reasons.push('Registered position monitoring stale or unavailable');
  if (fields.marketDataAbnormal) reasons.push('Market data abnormal');

  return {
    status: reasons.length ? 'NO_TRADE' : 'OK',
    reasons
  };
}

function currentHedgeFromPosition(positionRow, fallback) {
  const underlyingQty = optionalNumber(positionRow && positionRow.underlying_qty);
  const hedgeQty = optionalNumber(positionRow && positionRow.hedge_qty);
  if (underlyingQty === null || underlyingQty === 0 || hedgeQty === null) return fallback;
  return roundNumber(Math.abs(hedgeQty) / Math.abs(underlyingQty) * 100);
}

function modeLabel(mode) {
  if (mode === 't0') return 'T0_DISCOVERY';
  if (mode === 'daily') return 'ACTIVE_MONITORING_DAILY';
  if (mode === 'manual') return 'ACTIVE_MONITORING_MANUAL';
  return mode;
}

function buildAssetSnapshot(assetConfig, args, now, snapshotDate, liveMonitoringSignals, liveOptionDiscovery, positionRegister, livePositionMonitoring) {
  const monitoringMode = args.mode === 'daily' || args.mode === 'manual';
  const { rows, sources } = loadDailyRows(assetConfig);
  const { signals, source: signalSource } = loadSignals(assetConfig);
  const historicalRow = latestRowOnOrBefore(rows, snapshotDate);
  const liveMetrics = loadCurrentLiveMetrics(assetConfig, snapshotDate);
  const dailyRow = liveMetrics
    ? {
      ...(historicalRow || {}),
      date: snapshotDate,
      underlying_price: liveMetrics.current_price,
      source_file: path.relative(REPO_ROOT, assetConfig.liveMetricsPath)
    }
    : historicalRow;
  const liveSignalRow = liveMonitoringSignals.get(assetConfig.asset) || null;
  const liveOptionRow = liveOptionDiscovery.get(assetConfig.asset) || null;
  const historicalSignalRow = historicalRow ? signals.get(historicalRow.date) : null;
  const signalRow = liveSignalRow || historicalSignalRow;
  const monitoringSource = liveSignalRow
    ? path.relative(REPO_ROOT, LIVE_MONITORING_SIGNALS_PATH)
    : signalSource;
  const parsedInstrument = parseInstrument(historicalRow && historicalRow.instrument_name);
  const positionRow = monitoringMode ? positionRegister.positions.get(assetConfig.asset) || null : null;
  const positionMonitoringRow = monitoringMode ? livePositionMonitoring.rows.get(assetConfig.asset) || null : null;
  const accountSync = monitoringMode ? livePositionMonitoring.accountSync || null : null;
  const selectedOptionRow = monitoringMode ? null : liveOptionRow;
  const optionExpiry = positionRow ? positionRow.option_expiry : selectedOptionRow ? selectedOptionRow.selected_expiry : parsedInstrument.expiry;
  const optionStrike = positionRow ? optionalNumber(positionRow.option_strike) : selectedOptionRow ? optionalNumber(selectedOptionRow.selected_strike) : parsedInstrument.strike;
  const optionInstrument = positionRow ? positionRow.option_instrument : selectedOptionRow ? selectedOptionRow.selected_instrument : (historicalRow && historicalRow.instrument_name) || null;
  const optionPremium = selectedOptionRow
    ? optionalNumber(liveOptionRow.observed_premium)
    : positionMonitoringRow
      ? optionalNumber(positionMonitoringRow.option_mark_price)
    : optionalNumber(historicalRow && historicalRow.option_price_proxy);
  const optionPremiumSource = selectedOptionRow ? selectedOptionRow.premium_source : positionMonitoringRow ? 'bybit_registered_option_mark_price' : 'historical_option_price_proxy';
  const optionWarnings = [
    ...(selectedOptionRow && Array.isArray(selectedOptionRow.warnings) ? selectedOptionRow.warnings : []),
    ...(positionMonitoringRow && Array.isArray(positionMonitoringRow.warnings) ? positionMonitoringRow.warnings : []),
    ...(accountSync && Array.isArray(accountSync.warnings) ? accountSync.warnings : []),
    ...(monitoringMode && !positionRow ? ['Active monitoring requires an ACTIVE entry in live/position_register.json.'] : []),
    ...(monitoringMode && positionRow && positionMonitoringRow && positionMonitoringRow.option_instrument !== positionRow.option_instrument
      ? [`Registered option instrument mismatch: register=${positionRow.option_instrument}; monitoring=${positionMonitoringRow.option_instrument}.`]
      : []),
    ...(!monitoringMode && !selectedOptionRow && parsedInstrument.expiry ? ['Using historical option fields because live option discovery is unavailable for snapshot date.'] : [])
  ];
  const stale = isStale(dailyRow && dailyRow.date, snapshotDate);
  const signalDate = signalRow ? (signalRow.data_as_of || signalRow.date) : null;
  const signalStale = Boolean(signalRow && signalDate !== snapshotDate);
  const spotPrice = optionalNumber(dailyRow && dailyRow.underlying_price);
  const cliCurrentHedge = optionalNumber(args[assetConfig.currentHedgeArg]) ?? 0;
  const currentHedge = monitoringMode ? currentHedgeFromPosition(positionRow, cliCurrentHedge) : cliCurrentHedge;
  const normalCounter = optionalNumber(args[assetConfig.normalCounterArg]) ?? 0;
  const alertState = signalRow ? signalRow.alert_state : null;
  const damageState = signalRow ? signalRow.damage_state : null;
  const realizedVolDailyPct = liveMetrics
    ? roundNumber(optionalNumber(liveMetrics.realized_vol_daily_pct))
    : realizedVol30d(rows, dailyRow && dailyRow.date);
  const ewmaDailyPct = liveMetrics
    ? roundNumber(optionalNumber(liveMetrics.ewma_daily_pct))
    : roundNumber(optionalNumber(dailyRow && dailyRow.EWMA_vol_pct, signalRow && signalRow.ewma_vol_pct));
  const historicalVarPct = liveMetrics
    ? roundNumber(optionalNumber(liveMetrics.historical_VaR_pct))
    : roundNumber(optionalNumber(dailyRow && dailyRow.historical_VaR_pct));
  const baseTarget = alertState ? baseTargetForState(alertState) : null;
  const hysteresis = alertState
    ? applyHysteresis(alertState, baseTarget, currentHedge, normalCounter)
    : { targetHedge: currentHedge, resultingNormalCounter: normalCounter, hysteresisNote: 'missing_alert_state' };
  const breaker = circuitBreakers({
    dailyRow,
    stale,
    signalRow,
    signalStale,
    spotPrice,
    ewma: ewmaDailyPct,
    historicalVaR: historicalVarPct,
    optionExpiry,
    optionStrike,
    monitoringMode,
    positionRow,
    positionMonitoringStale: monitoringMode && (!positionMonitoringRow || positionMonitoringRow.data_as_of !== snapshotDate),
    marketDataAbnormal: Boolean(dailyRow && dailyRow.notes && String(dailyRow.notes).includes('suspicious'))
  });

  const targetHedge = breaker.status === 'OK' ? hysteresis.targetHedge : currentHedge;
  const executedDeltaRecommendation = roundNumber(targetHedge - currentHedge);
  const executionState = executionStateFor(targetHedge);
  const todayAction = todayActionFor(assetConfig.asset, targetHedge, executedDeltaRecommendation);
  const warning = staleWarning(dailyRow && dailyRow.date, snapshotDate);
  const accounting = accountingFields(positionRow, positionMonitoringRow, spotPrice, snapshotDate);

  return {
    asset: assetConfig.asset,
    venue: args.venue,
    timestamp: decisionTimestamp(now, args),
    snapshot_date: snapshotDate,
    data_as_of: dailyRow ? dailyRow.date : null,
    market_data_source: liveMetrics ? 'live_refresh' : 'historical_daily_mtm',
    live_metrics_used: Boolean(liveMetrics),
    live_metrics_timestamp: liveMetrics ? liveMetrics.timestamp : null,
    spot_price: roundNumber(spotPrice),
    return_7d_pct: liveMetrics ? roundNumber(optionalNumber(liveMetrics.return_7d_pct)) : roundNumber(spotReturnPct(dailyRow, rowDaysBefore(rows, dailyRow && dailyRow.date, 7))),
    return_30d_pct: liveMetrics ? roundNumber(optionalNumber(liveMetrics.return_30d_pct)) : roundNumber(spotReturnPct(dailyRow, rowDaysBefore(rows, dailyRow && dailyRow.date, 30))),
    return_90d_pct: liveMetrics ? roundNumber(optionalNumber(liveMetrics.return_90d_pct)) : roundNumber(spotReturnPct(dailyRow, rowDaysBefore(rows, dailyRow && dailyRow.date, 90))),
    realized_vol_30d_pct: realizedVolDailyPct,
    realized_vol_daily_pct: realizedVolDailyPct,
    realized_vol_annualized_pct: annualizeDailyVolPct(realizedVolDailyPct),
    EWMA_pct: ewmaDailyPct,
    ewma_daily_pct: ewmaDailyPct,
    ewma_annualized_pct: annualizeDailyVolPct(ewmaDailyPct),
    historical_VaR_pct: historicalVarPct,
    historical_var_confidence: '95%',
    historical_var_horizon: '1D',
    historical_var_expected_tail_days: HISTORICAL_VAR_EXPECTED_TAIL_DAYS,
    historical_var_interpretation: 'Estimated one-day loss threshold derived from recent historical returns. Approximately 5% of observed days experienced losses worse than this level.',
    damage_state: damageState,
    alert_state: alertState,
    position_status: positionRow ? positionRow.position_status : null,
    account_sync: positionMonitoringRow && positionMonitoringRow.account_sync ? positionMonitoringRow.account_sync : accountSync ? {
      data_source: accountSync.data_source,
      last_sync: accountSync.last_sync,
      environment: accountSync.environment,
      base_url: accountSync.base_url,
      available: Boolean(accountSync.available),
      read_only: true,
      testnet: Boolean(accountSync.testnet)
    } : null,
    option_expiry: optionExpiry,
    days_to_expiration: accounting.days_to_expiry ?? (positionRow ? daysBetween(snapshotDate, optionExpiry) : selectedOptionRow ? optionalNumber(liveOptionRow.days_to_expiration) : null),
    days_to_expiry: accounting.days_to_expiry,
    days_since_entry: accounting.days_since_entry,
    OTM05_target_strike: optionStrike,
    selected_option_instrument: optionInstrument,
    position_register_source: positionRow ? positionRegister.source : null,
    cycle_id: positionRow ? positionRow.cycle_id : null,
    underlying_qty: positionRow ? optionalNumber(positionRow.underlying_qty) : null,
    underlying_entry_price: accounting.underlying_entry_price,
    underlying_entry_timestamp: accounting.underlying_entry_timestamp,
    underlying_entry_ts: accounting.underlying_entry_ts,
    underlying_cost_basis: accounting.underlying_cost_basis,
    cycle_accounting: accounting.cycle_accounting,
    current_spot_price: accounting.current_spot_price,
    underlying_market_value: accounting.underlying_market_value,
    underlying_unrealized_pnl: accounting.underlying_unrealized_pnl,
    short_call_symbol: accounting.short_call_symbol,
    short_call_qty: accounting.short_call_qty,
    short_call_expiry: accounting.short_call_expiry,
    short_call_strike: accounting.short_call_strike,
    short_call_entry_premium: accounting.short_call_entry_premium,
    short_call_entry_timestamp: accounting.short_call_entry_timestamp,
    option_qty: accounting.short_call_qty,
    option_entry_premium: accounting.short_call_entry_premium,
    premium_received: accounting.premium_received,
    hedge_instrument: positionRow ? positionRow.hedge_instrument : null,
    hedge_qty: positionRow ? optionalNumber(positionRow.hedge_qty) : null,
    hedge_entry_price: positionRow ? optionalNumber(positionRow.hedge_entry_price) : null,
    hedge_entry_timestamp: accounting.hedge_entry_timestamp,
    hedge_cost_basis: accounting.hedge_cost_basis,
    distance_to_strike_pct: spotPrice === null || optionStrike === null || spotPrice === 0 ? null : roundNumber((optionStrike / spotPrice - 1) * 100),
    observed_option_premium: roundNumber(optionPremium),
    option_data_source: positionMonitoringRow ? path.relative(REPO_ROOT, LIVE_POSITION_MONITORING_PATH) : selectedOptionRow ? path.relative(REPO_ROOT, LIVE_OPTION_DISCOVERY_PATH) : 'historical_daily_mtm',
    option_premium_source: optionPremiumSource,
    premium_status: premiumStatusFor(optionPremiumSource, optionPremium),
    option_bid: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_bid)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_bid)) : null,
    option_ask: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_ask)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_ask)) : null,
    option_mark_price: accounting.option_mark_price,
    option_last_price: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_last_price)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_last_price)) : null,
    option_greeks: positionMonitoringRow && positionMonitoringRow.greeks ? positionMonitoringRow.greeks : null,
    option_mtm_pnl: accounting.option_unrealized_pnl_approx,
    option_unrealized_pnl_approx: accounting.option_unrealized_pnl_approx,
    hedge_mark_price: accounting.hedge_mark_price,
    hedge_unrealized_pnl_approx: accounting.hedge_unrealized_pnl_approx,
    net_unrealized_pnl_approx: accounting.net_unrealized_pnl_approx,
    current_cycle_accounting: accounting.current_cycle_accounting,
    portfolio_lifetime_accounting: accounting.portfolio_lifetime_accounting,
    legacy_accounting_note: accounting.legacy_accounting_note,
    cycle_underlying_pnl: accounting.cycle_underlying_pnl,
    cycle_option_pnl: accounting.cycle_option_pnl,
    cycle_hedge_pnl: accounting.cycle_hedge_pnl,
    net_cycle_pnl: accounting.net_cycle_pnl,
    net_cycle_pnl_pct: accounting.net_cycle_pnl_pct,
    cycle_capital_base: accounting.cycle_capital_base,
    portfolio_underlying_pnl: accounting.portfolio_underlying_pnl,
    portfolio_option_pnl: accounting.portfolio_option_pnl,
    portfolio_hedge_pnl: accounting.portfolio_hedge_pnl,
    portfolio_net_pnl: accounting.portfolio_net_pnl,
    portfolio_net_pnl_pct: accounting.portfolio_net_pnl_pct,
    portfolio_capital_base: accounting.portfolio_capital_base,
    accumulated_fees: accounting.accumulated_fees,
    option_warnings: dedupeWarnings([...optionWarnings, ...accounting.accounting_warnings]),
    current_hedge_pct: currentHedge,
    target_hedge_pct: targetHedge,
    executed_delta_recommendation_pct: executedDeltaRecommendation,
    execution_state: executionState,
    today_action: todayAction,
    ...(warning ? { stale_warning: warning } : {}),
    normal_counter: hysteresis.resultingNormalCounter,
    circuit_breaker_status: breaker.status,
    circuit_breaker_reasons: breaker.reasons,
    comments: [
      'Research-grade read-only snapshot; no orders placed.',
      hysteresis.hysteresisNote,
      liveMetrics ? `Live market data source: ${path.relative(REPO_ROOT, assetConfig.liveMetricsPath)}.` : 'Live market data unavailable for snapshot date; using historical Daily MTM fallback.',
      monitoringMode ? `Active monitoring uses Position Register source: ${positionRegister.source || 'missing'}.` : selectedOptionRow ? `Live option discovery source: ${path.relative(REPO_ROOT, LIVE_OPTION_DISCOVERY_PATH)}.` : 'Live option discovery unavailable for snapshot date; using historical option fallback if present.',
      accountSync ? `Account sync source: ${accountSync.data_source || 'N/A'}; env=${accountSync.environment || 'N/A'}; base_url=${accountSync.base_url || 'N/A'}; available=${Boolean(accountSync.available)}; last_sync=${accountSync.last_sync || 'N/A'}.` : 'Account sync metadata unavailable.',
      monitoringSource ? `Monitoring source: ${monitoringSource}.` : 'No monitoring signal source available for this asset.',
      sources.length ? `Daily MTM source count: ${sources.length}.` : 'No Daily MTM source available.'
    ].join(' '),
    source_files: {
      daily_mtm: sources,
      live_metrics: liveMetrics ? path.relative(REPO_ROOT, assetConfig.liveMetricsPath) : null,
      monitoring_signal: monitoringSource,
      option_discovery: selectedOptionRow ? path.relative(REPO_ROOT, LIVE_OPTION_DISCOVERY_PATH) : null,
      position_register: positionRow ? positionRegister.source : null,
      position_monitoring: positionMonitoringRow ? path.relative(REPO_ROOT, LIVE_POSITION_MONITORING_PATH) : null
    }
  };
}

function renderMarkdown(snapshot) {
  const rows = snapshot.assets.map(asset => [
    asset.asset,
    asset.data_as_of || '',
    formatPrice(asset.spot_price),
    asset.damage_state || '',
    asset.alert_state || '',
    formatHedgePct(asset.current_hedge_pct),
    formatHedgePct(asset.target_hedge_pct),
    formatHedgePct(asset.executed_delta_recommendation_pct),
    asset.execution_state || '',
    asset.circuit_breaker_status,
    asset.circuit_breaker_reasons.join('; ')
  ]);

  return [
    '# Live Research Snapshot',
    '',
    ...snapshotMetadataMarkdown(snapshot),
    `- Venue: ${snapshot.venue}.`,
    `- Status: research-grade, read-only, no orders placed.`,
    '',
    '## Asset Summary',
    '',
    '| Asset | Data As Of | Spot | Damage | Alert | Current Hedge | Target Hedge | Delta | Execution State | Circuit Breaker | Reasons |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Details',
    '',
    ...snapshot.assets.flatMap(asset => [
      `### ${asset.asset}`,
      '',
      ...staleWarningMarkdown(asset),
      `Spot: ${formatPrice(asset.spot_price)}`,
      `Account sync: ${asset.account_sync ? `${asset.account_sync.data_source || 'N/A'} / ${asset.account_sync.environment || 'N/A'} / ${asset.account_sync.base_url || 'N/A'} / ${asset.account_sync.last_sync || 'N/A'} / available=${String(Boolean(asset.account_sync.available))}` : 'N/A'}`,
      '',
      'Returns',
      '',
      `- 7d: ${formatPct(asset.return_7d_pct)}.`,
      `- 30d: ${formatPct(asset.return_30d_pct)}.`,
      `- 90d: ${formatPct(asset.return_90d_pct)}.`,
      '',
      'Risk',
      '',
      'Realized Vol:',
      '',
      `- ${formatPct(asset.realized_vol_daily_pct)} daily.`,
      `- ${formatPct(asset.realized_vol_annualized_pct)} annualized.`,
      '',
      'EWMA:',
      '',
      `- ${formatPct(asset.ewma_daily_pct)} daily.`,
      `- ${formatPct(asset.ewma_annualized_pct)} annualized.`,
      '',
      'Historical VaR (95%, 1D):',
      '',
      `- ${formatPct(asset.historical_VaR_pct)}.`,
      '- Estimated one-day loss threshold derived from recent historical returns.',
      '- Approximately 5% of observed days experienced losses worse than this level.',
      '',
      'Expected Tail Frequency:',
      '',
      `- ~1 day every ${value(asset.historical_var_expected_tail_days)} days.`,
      '',
      'Monitoring',
      '',
      `- damage_state: ${asset.damage_state || ''}.`,
      `- alert_state: ${asset.alert_state || ''}.`,
      '',
      'Execution',
      '',
      `- execution_state: ${asset.execution_state || ''}.`,
      `- current_hedge: ${formatHedgePct(asset.current_hedge_pct)}.`,
      `- target_hedge: ${formatHedgePct(asset.target_hedge_pct)}.`,
      `- delta: ${formatHedgePct(asset.executed_delta_recommendation_pct)}.`,
      `- today_action: ${asset.today_action || ''}.`,
      '',
      'Position',
      '',
      `- Cycle ID: ${asset.cycle_id || ''}.`,
      `- Option expiry: ${asset.option_expiry || ''}.`,
      `- Days to expiration (DTE): ${value(asset.days_to_expiration)}.`,
      `- Selected option: ${asset.selected_option_instrument || ''}.`,
      `- OTM05 target strike: ${formatPrice(asset.OTM05_target_strike)}.`,
      `- Distance to strike: ${formatPct(asset.distance_to_strike_pct)}.`,
      `- Underlying qty: ${value(asset.underlying_qty)}.`,
      `- Underlying original entry price: ${formatPrice(asset.underlying_entry_price)}.`,
      `- Underlying cycle reference price: ${formatPrice(asset.current_cycle_accounting && asset.current_cycle_accounting.underlying_reference_price)}.`,
      `- Option qty: ${value(asset.option_qty)}.`,
      `- Option entry premium: ${formatPrice(asset.option_entry_premium)}.`,
      `- Premium received: ${formatPrice(asset.premium_received)}.`,
      `- Premium Status: ${asset.premium_status || ''}.`,
      `- Observed premium: ${formatPremium(asset)}.`,
      ...premiumNoteMarkdown(asset),
      `- Premium source: ${asset.option_premium_source || ''}.`,
      `- Option bid / ask / mark / last: ${formatPrice(asset.option_bid)} / ${formatPrice(asset.option_ask)} / ${formatPrice(asset.option_mark_price)} / ${formatPrice(asset.option_last_price)}.`,
      `- Option MTM P&L: ${formatPrice(asset.option_mtm_pnl)}.`,
      `- Greeks delta / gamma / vega / theta: ${formatGreek(asset.option_greeks, 'delta')} / ${formatGreek(asset.option_greeks, 'gamma')} / ${formatGreek(asset.option_greeks, 'vega')} / ${formatGreek(asset.option_greeks, 'theta')}.`,
      `- Hedge instrument: ${asset.hedge_instrument || ''}.`,
      `- Hedge qty: ${value(asset.hedge_qty)}.`,
      `- Hedge entry price: ${formatPrice(asset.hedge_entry_price)}.`,
      `- Hedge mark price: ${formatPrice(asset.hedge_mark_price)}.`,
      '',
      'Current Cycle Accounting',
      '',
      `- Underlying PnL since cycle open: ${formatPrice(asset.cycle_underlying_pnl)}.`,
      `- Option PnL current cycle: ${formatPrice(asset.cycle_option_pnl)}.`,
      `- Hedge PnL current cycle: ${formatPrice(asset.cycle_hedge_pnl)}.`,
      `- Net Cycle PnL: ${formatPrice(asset.net_cycle_pnl)}.`,
      `- Net Cycle PnL %: ${formatPct(asset.net_cycle_pnl_pct)}.`,
      `- Capital Base: ${formatPrice(asset.cycle_capital_base)}.`,
      '',
      'Portfolio / Lifetime Accounting',
      '',
      `- Underlying PnL since original spot purchase: ${formatPrice(asset.portfolio_underlying_pnl)}.`,
      `- Current Option PnL: ${formatPrice(asset.portfolio_option_pnl)}.`,
      `- Current Hedge PnL: ${formatPrice(asset.portfolio_hedge_pnl)}.`,
      `- Portfolio Net PnL: ${formatPrice(asset.portfolio_net_pnl)}.`,
      `- Portfolio Net PnL %: ${formatPct(asset.portfolio_net_pnl_pct)}.`,
      `- Capital Base: ${formatPrice(asset.portfolio_capital_base)}.`,
      ...optionWarningsMarkdown(asset),
      `- Normal counter: ${value(asset.normal_counter)}.`,
      `- Comments: ${asset.comments}`,
      ''
    ]),
    '## Limitations',
    '',
    '- This snapshot is a manual research aid, not production execution.',
    '- Circuit breakers block trade recommendations when required data is missing, stale, or unavailable.',
    '- Funding, fees, slippage, liquidation, and margin stress remain outside this v0.1 snapshot.'
  ].join('\n');
}

function renderActiveMonitoringReport(snapshot) {
  const rows = snapshot.assets.map(asset => [
    asset.asset,
    formatPrice(asset.spot_price),
    asset.damage_state || 'N/A',
    asset.alert_state || 'N/A',
    formatPct(asset.ewma_daily_pct),
    formatPct(asset.historical_VaR_pct),
    formatHedgePct(asset.current_hedge_pct),
    formatHedgePct(asset.target_hedge_pct),
    asset.execution_state || 'N/A',
    asset.today_action || 'N/A',
    asset.circuit_breaker_status || 'N/A'
  ]);

  return [
    '# Active Monitoring Daily',
    '',
    ...snapshotMetadataMarkdown(snapshot),
    '- Status: read-only research aid; no orders placed.',
    '',
    '## Operator Summary',
    '',
    '| Asset | Price | Damage | Alert | EWMA Daily | Historical VaR | Current Hedge | Target Hedge | Execution State | Today Action | Circuit Breaker |',
    '| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Asset Details',
    '',
    ...snapshot.assets.flatMap(asset => [
      `### ${asset.asset}`,
      '',
      `- Asset: ${asset.asset}.`,
      `- Current price: ${formatPrice(asset.spot_price)}.`,
      `- Data as of: ${asset.data_as_of || 'N/A'}.`,
      `- Market data source: ${asset.market_data_source || 'N/A'}.`,
      `- Account sync source: ${asset.account_sync ? asset.account_sync.data_source : 'N/A'}.`,
      `- Account sync env / base URL: ${asset.account_sync ? asset.account_sync.environment || 'N/A' : 'N/A'} / ${asset.account_sync ? asset.account_sync.base_url || 'N/A' : 'N/A'}.`,
      `- Account sync last sync / available: ${asset.account_sync ? asset.account_sync.last_sync || 'N/A' : 'N/A'} / ${asset.account_sync ? String(Boolean(asset.account_sync.available)) : 'N/A'}.`,
      `- Realized vol daily / annualized: ${formatPct(asset.realized_vol_daily_pct)} / ${formatPct(asset.realized_vol_annualized_pct)}.`,
      `- EWMA daily / annualized: ${formatPct(asset.ewma_daily_pct)} / ${formatPct(asset.ewma_annualized_pct)}.`,
      `- Historical VaR: ${formatPct(asset.historical_VaR_pct)}.`,
      `- Damage state / alert state: ${asset.damage_state || 'N/A'} / ${asset.alert_state || 'N/A'}.`,
      `- Current hedge / target hedge / delta: ${formatHedgePct(asset.current_hedge_pct)} / ${formatHedgePct(asset.target_hedge_pct)} / ${formatHedgePct(asset.executed_delta_recommendation_pct)}.`,
      `- Execution state: ${asset.execution_state || 'N/A'}.`,
      `- Today action: ${asset.today_action || 'N/A'}.`,
      `- Selected option: ${asset.selected_option_instrument || 'N/A'}.`,
      `- Expiry / DTE: ${asset.option_expiry || 'N/A'} / ${valueOrNa(asset.days_to_expiration)}.`,
      `- Strike: ${formatPrice(asset.OTM05_target_strike)}.`,
      `- Days since entry: ${valueOrNa(asset.days_since_entry)}.`,
      `- Underlying original entry: ${formatPrice(asset.underlying_entry_price)}.`,
      `- Premium: ${formatPremium(asset)}.`,
      `- Premium received: ${formatPrice(asset.premium_received)}.`,
      `- Premium status / source: ${asset.premium_status || 'N/A'} / ${asset.option_premium_source || 'N/A'}.`,
      `- Option bid / ask / mark / last: ${formatPrice(asset.option_bid)} / ${formatPrice(asset.option_ask)} / ${formatPrice(asset.option_mark_price)} / ${formatPrice(asset.option_last_price)}.`,
      `- Hedge mark: ${formatPrice(asset.hedge_mark_price)}.`,
      '',
      'Current Cycle Accounting',
      '',
      `- Underlying reference / source: ${formatPrice(asset.current_cycle_accounting && asset.current_cycle_accounting.underlying_reference_price)} / ${asset.current_cycle_accounting && asset.current_cycle_accounting.underlying_reference_source || 'N/A'}.`,
      `- Underlying PnL since cycle open: ${formatPrice(asset.cycle_underlying_pnl)}.`,
      `- Option PnL current cycle: ${formatPrice(asset.cycle_option_pnl)}.`,
      `- Hedge PnL current cycle: ${formatPrice(asset.cycle_hedge_pnl)}.`,
      `- Net Cycle PnL: ${formatPrice(asset.net_cycle_pnl)}.`,
      `- Net Cycle PnL %: ${formatPct(asset.net_cycle_pnl_pct)}.`,
      `- Capital Base: ${formatPrice(asset.cycle_capital_base)}.`,
      '',
      'Portfolio / Lifetime Accounting',
      '',
      `- Underlying PnL since original spot purchase: ${formatPrice(asset.portfolio_underlying_pnl)}.`,
      `- Current Option PnL: ${formatPrice(asset.portfolio_option_pnl)}.`,
      `- Current Hedge PnL: ${formatPrice(asset.portfolio_hedge_pnl)}.`,
      `- Portfolio Net PnL: ${formatPrice(asset.portfolio_net_pnl)}.`,
      `- Portfolio Net PnL %: ${formatPct(asset.portfolio_net_pnl_pct)}.`,
      `- Capital Base: ${formatPrice(asset.portfolio_capital_base)}.`,
      `- Circuit breaker: ${asset.circuit_breaker_status || 'N/A'}.`,
      ...reportWarningsMarkdown(asset),
      ''
    ]),
    '## Snapshot Archive',
    '',
    `- Date folder: live/snapshots/${snapshot.snapshot_date}/.`,
    `- Snapshot JSON: live/snapshots/${snapshot.output_basename}.json.`,
    `- Snapshot markdown: live/snapshots/${snapshot.output_basename}.md.`,
    '',
    '## Notes',
    '',
    '- Missing fields are shown as N/A.',
    '- This report consolidates existing live artifacts and snapshot fields only.',
    '- Manual execution decisions remain outside this script.'
  ].join('\n');
}

function accountSyncLastSyncFromAssets(assets) {
  const values = [...new Set((assets || [])
    .map(asset => asset && asset.account_sync && asset.account_sync.last_sync)
    .filter(Boolean))];
  return values.length ? values.join('; ') : null;
}

function snapshotMetadataMarkdown(snapshot) {
  return [
    `- Snapshot date: ${snapshot.snapshot_date || 'N/A'}.`,
    `- Decision timestamp: ${snapshot.decision_timestamp || 'N/A'}.`,
    `- Generated at: ${snapshot.generated_at_local || snapshot.generated_at || 'N/A'}.`,
    `- Account sync last sync: ${snapshot.account_sync_last_sync || 'N/A'}.`,
    `- Run mode: ${snapshot.run_mode || snapshot.mode || 'N/A'}.`
  ];
}

function snapshotMetadataHtmlBlocks(snapshot) {
  return [
    `<div class="block"><h3>Run Metadata</h3>${htmlMetric('Snapshot date', snapshot.snapshot_date || 'N/A')}${htmlMetric('Run mode', snapshot.run_mode || snapshot.mode || 'N/A')}</div>`,
    `<div class="block"><h3>Execution</h3>${htmlMetric('Decision timestamp', snapshot.decision_timestamp || 'N/A')}${htmlMetric('Generated at', snapshot.generated_at_local || snapshot.generated_at || 'N/A')}</div>`,
    `<div class="block"><h3>Account Sync</h3>${htmlMetric('Last sync', snapshot.account_sync_last_sync || 'N/A')}${htmlMetric('Timezone', snapshot.timezone || 'N/A')}</div>`
  ];
}

function warningsForAsset(asset) {
  const warnings = [];
  if (asset.stale_warning) {
    warnings.push(`Stale data: source data_as_of=${asset.stale_warning.data_as_of}; snapshot_date=${asset.stale_warning.snapshot_date}.`);
  }
  if (Array.isArray(asset.option_warnings)) warnings.push(...asset.option_warnings);
  if (Array.isArray(asset.circuit_breaker_reasons)) {
    warnings.push(...asset.circuit_breaker_reasons.map(reason => `Circuit breaker reason: ${reason}`));
  }
  return dedupeWarnings(warnings);
}

function renderActiveAssetCard(asset) {
  return `<section class="card">
  <h2>${escapeHtml(asset.asset)} <span class="pill ${stateClass(asset.alert_state)}">${escapeHtml(asset.alert_state || 'N/A')}</span></h2>
  <div class="card-body">
    <div class="subgrid">
      <div class="block">
        <h3>Market</h3>
        ${htmlMetric('Current price', formatPrice(asset.spot_price))}
        ${htmlMetric('Regime', asset.alert_state || 'N/A', stateClass(asset.alert_state))}
        ${htmlMetric('Today action', asset.today_action || 'N/A')}
        ${htmlMetric('Execution state', asset.execution_state || 'N/A', stateClass(asset.execution_state))}
      </div>
      <div class="block">
        <h3>Hedge</h3>
        ${htmlMetric('Target hedge', formatHedgePct(asset.target_hedge_pct))}
        ${htmlMetric('Current hedge', formatHedgePct(asset.current_hedge_pct))}
        ${htmlMetric('Delta', formatHedgePct(asset.executed_delta_recommendation_pct))}
        ${htmlMetric('Circuit breaker', asset.circuit_breaker_status || 'N/A', stateClass(asset.circuit_breaker_status))}
      </div>
      <div class="block">
        <h3>Position</h3>
        ${htmlMetric('Days since entry', valueOrNa(asset.days_since_entry))}
        ${htmlMetric('Days to expiry', valueOrNa(asset.days_to_expiration))}
        ${htmlMetric('Cycle ID', asset.cycle_id || 'N/A')}
        ${htmlMetric('Position status', asset.position_status || 'N/A')}
        ${htmlMetric('Account sync', asset.account_sync ? `${asset.account_sync.environment || 'N/A'} / ${asset.account_sync.available ? 'available' : 'fallback'}` : 'N/A', asset.account_sync && asset.account_sync.available ? 'pos' : 'warn')}
      </div>
      <div class="block">
        <h3>Underlying</h3>
        ${htmlMetric('Quantity', valueOrNa(asset.underlying_qty))}
        ${htmlMetric('Original entry price', formatPrice(asset.underlying_entry_price))}
        ${htmlMetric('Cycle reference', formatPrice(asset.current_cycle_accounting && asset.current_cycle_accounting.underlying_reference_price))}
      </div>
      <div class="block">
        <h3>Short Call</h3>
        ${htmlMetric('Symbol', asset.short_call_symbol || asset.selected_option_instrument || 'N/A')}
        ${htmlMetric('Expiry', asset.short_call_expiry || asset.option_expiry || 'N/A')}
        ${htmlMetric('Strike', formatPrice(asset.short_call_strike || asset.OTM05_target_strike))}
        ${htmlMetric('Premium received', formatPrice(asset.premium_received))}
        ${htmlMetric('Mark price', formatPrice(asset.option_mark_price))}
        ${htmlMetric('Option PnL approx', formatPrice(asset.option_unrealized_pnl_approx), pnlClass(asset.option_unrealized_pnl_approx))}
      </div>
      <div class="block">
        <h3>Hedge Accounting</h3>
        ${htmlMetric('Hedge quantity', valueOrNa(asset.hedge_qty))}
        ${htmlMetric('Entry price', formatPrice(asset.hedge_entry_price))}
        ${htmlMetric('Mark price', formatPrice(asset.hedge_mark_price))}
        ${htmlMetric('Hedge PnL', formatPrice(asset.hedge_unrealized_pnl_approx), pnlClass(asset.hedge_unrealized_pnl_approx))}
        ${htmlMetric('Source', asset.source_files && asset.source_files.position_monitoring ? asset.source_files.position_monitoring : 'N/A')}
      </div>
      <div class="block">
        <h3>Current Cycle Accounting</h3>
        ${htmlMetric('Underlying PnL since cycle open', formatPrice(asset.cycle_underlying_pnl), pnlClass(asset.cycle_underlying_pnl))}
        ${htmlMetric('Option PnL current cycle', formatPrice(asset.cycle_option_pnl), pnlClass(asset.cycle_option_pnl))}
        ${htmlMetric('Hedge PnL current cycle', formatPrice(asset.cycle_hedge_pnl), pnlClass(asset.cycle_hedge_pnl))}
        ${htmlMetric('Net Cycle PnL', `${formatPrice(asset.net_cycle_pnl)} (${formatPct(asset.net_cycle_pnl_pct)})`, pnlClass(asset.net_cycle_pnl))}
        ${htmlMetric('Capital Base', formatPrice(asset.cycle_capital_base))}
      </div>
      <div class="block">
        <h3>Portfolio / Lifetime Accounting</h3>
        ${htmlMetric('Underlying PnL since original spot purchase', formatPrice(asset.portfolio_underlying_pnl), pnlClass(asset.portfolio_underlying_pnl))}
        ${htmlMetric('Current Option PnL', formatPrice(asset.portfolio_option_pnl), pnlClass(asset.portfolio_option_pnl))}
        ${htmlMetric('Current Hedge PnL', formatPrice(asset.portfolio_hedge_pnl), pnlClass(asset.portfolio_hedge_pnl))}
        ${htmlMetric('Portfolio Net PnL', `${formatPrice(asset.portfolio_net_pnl)} (${formatPct(asset.portfolio_net_pnl_pct)})`, pnlClass(asset.portfolio_net_pnl))}
        ${htmlMetric('Capital Base', formatPrice(asset.portfolio_capital_base))}
      </div>
    </div>
  </div>
</section>`;
}

function renderGroupedWarningsSection(snapshot) {
  const groups = snapshot.assets
    .map(asset => ({ asset: asset.asset, warnings: warningsForAsset(asset) }))
    .filter(group => group.warnings.length);
  const body = groups.length
    ? groups.map(group => `<div class="block"><h3>${escapeHtml(group.asset)}</h3>${htmlWarnings(group.warnings)}</div>`).join('\n')
    : '<div class="block"><h3>Warnings</h3><div class="warning-list muted">N/A</div></div>';
  return `<section class="section"><h2>Warnings</h2><div class="section-body summary-bar">${body}</div></section>`;
}

function renderActiveMonitoringHtml(snapshot) {
  const warnings = snapshot.assets.flatMap(warningsForAsset);
  const staleCount = snapshot.assets.filter(asset => asset.stale_warning).length;
  const summaryItems = snapshot.assets.map(asset => `<div class="block">
    <h3>${escapeHtml(asset.asset)}</h3>
    ${htmlMetric('Regime', asset.alert_state || 'N/A', stateClass(asset.alert_state))}
    ${htmlMetric('Hedge target', formatHedgePct(asset.target_hedge_pct))}
    ${htmlMetric('Status', asset.circuit_breaker_status || 'N/A', stateClass(asset.circuit_breaker_status))}
  </div>`).join('');

  const body = [
    '<div class="summary-bar">',
    ...snapshotMetadataHtmlBlocks(snapshot),
    `<div class="block"><h3>Freshness</h3>${htmlMetric('Stale assets', staleCount, staleCount ? 'warn' : 'pos')}${htmlMetric('Warnings', warnings.length, warnings.length ? 'warn' : 'pos')}</div>`,
    `<div class="block"><h3>Warnings</h3>${htmlMetric('Count', warnings.length, warnings.length ? 'warn' : 'pos')}${htmlMetric('Read only', 'No orders placed')}</div>`,
    `<div class="block"><h3>Venue</h3>${htmlMetric('Venue', snapshot.venue)}${htmlMetric('Timezone', snapshot.timezone)}</div>`,
    '</div>',
    '<div class="grid">',
    ...snapshot.assets.map(renderActiveAssetCard),
    '</div>',
    renderGroupedWarningsSection(snapshot),
    '<section class="section"><h2>Summary Bar</h2><div class="section-body summary-bar">',
    summaryItems,
    '</div></section>'
  ].join('\n');

  return htmlShell('Active Monitoring Daily', `${snapshot.snapshot_date} | ${snapshot.decision_timestamp}`, body);
}

function reportWarningsMarkdown(asset) {
  const warnings = [];
  if (asset.stale_warning) {
    warnings.push(`Stale data: source data_as_of=${asset.stale_warning.data_as_of}; snapshot_date=${asset.stale_warning.snapshot_date}.`);
  }
  if (Array.isArray(asset.option_warnings)) warnings.push(...asset.option_warnings);
  if (Array.isArray(asset.circuit_breaker_reasons)) {
    warnings.push(...asset.circuit_breaker_reasons.map(reason => `Circuit breaker reason: ${reason}`));
  }
  const uniqueWarnings = dedupeWarnings(warnings);
  if (!uniqueWarnings.length) return ['- Warnings: N/A.'];
  return uniqueWarnings.map(warning => `- Warning: ${warning}`);
}

function escapeHtml(raw) {
  return String(raw === null || raw === undefined || raw === '' ? 'N/A' : raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pnlClass(raw) {
  const number = optionalNumber(raw);
  if (number === null) return 'na';
  if (number > 0) return 'pos';
  if (number < 0) return 'neg';
  return 'flat';
}

function stateClass(raw) {
  const value = String(raw || '').toLowerCase();
  if (value.includes('crisis')) return 'state-crisis';
  if (value.includes('stress')) return 'state-stress';
  if (value.includes('watch')) return 'state-watch';
  if (value.includes('normal')) return 'state-normal';
  if (value.includes('ok')) return 'state-normal';
  if (value.includes('no_trade')) return 'state-watch';
  return 'state-neutral';
}

function htmlValue(raw, className = '') {
  return `<span class="${className}">${escapeHtml(raw)}</span>`;
}

function htmlMetric(label, valueText, className = '') {
  return `<div class="metric"><span>${escapeHtml(label)}</span><b class="${className}">${escapeHtml(valueText)}</b></div>`;
}

function htmlWarnings(warnings) {
  if (!warnings.length) return '<div class="warning-list muted">N/A</div>';
  return `<div class="badge">WARN ${warnings.length}</div><ul class="warning-list">${warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`;
}

function htmlShell(title, subtitle, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --bg: #f4f6f8;
  --panel: #ffffff;
  --panel2: #f8fafc;
  --grid: #c9d2dc;
  --text: #111827;
  --muted: #5c6670;
  --accent: #1f4e79;
  --green: #087a2f;
  --red: #b00020;
  --amber: #9a5a00;
  --orange: #b85c00;
  --blue: #1f5f99;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Consolas, "Lucida Console", Monaco, "Courier New", monospace;
  font-size: 12px;
  line-height: 1.32;
}
.terminal {
  padding: 12px;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--grid);
  border-left: 5px solid var(--accent);
  background: #ffffff;
  padding: 9px 10px;
  margin-bottom: 10px;
}
h1 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  letter-spacing: .5px;
  text-transform: uppercase;
}
.subtitle { color: var(--muted); margin-top: 2px; }
.stamp { text-align: right; color: var(--muted); white-space: nowrap; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.card, .section {
  border: 1px solid var(--grid);
  background: var(--panel);
}
.card h2, .section h2 {
  margin: 0;
  padding: 7px 9px;
  color: #111827;
  font-size: 13px;
  background: #e9edf2;
  border-bottom: 1px solid var(--grid);
}
.card-body { padding: 8px; display: grid; gap: 8px; }
.subgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.block { border: 1px solid var(--grid); background: var(--panel2); padding: 7px; }
.block h3 {
  margin: 0 0 5px 0;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
}
.metric {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px dotted #d5dce4;
  padding: 2px 0;
}
.metric span { color: var(--muted); }
.metric b { color: var(--text); font-weight: 600; text-align: right; }
.summary-bar { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
.pill {
  display: inline-block;
  border: 1px solid var(--grid);
  padding: 2px 6px;
  background: #eef3f8;
  color: var(--text);
}
.badge {
  display: inline-block;
  margin-bottom: 4px;
  padding: 2px 6px;
  border: 1px solid #d19a2e;
  background: #fff5d6;
  color: var(--amber);
  font-weight: 700;
}
.pos { color: var(--green) !important; }
.neg { color: var(--red) !important; }
.flat { color: var(--text) !important; }
.na, .muted { color: var(--muted) !important; }
.warn, .state-watch { color: var(--amber) !important; }
.state-stress { color: var(--orange) !important; }
.state-crisis { color: var(--red) !important; }
.state-normal { color: var(--green) !important; }
.state-neutral { color: var(--text) !important; }
.warning-list { margin: 0; padding-left: 18px; color: var(--amber); }
.warning-list li { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td {
  border-bottom: 1px solid #d8dee6;
  padding: 5px 6px;
  text-align: left;
  vertical-align: top;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: #111827;
  background: #e9edf2;
  border-bottom: 1px solid var(--accent);
  text-transform: uppercase;
  font-size: 11px;
}
tr:nth-child(even) td { background: #f8fafc; }
.num { text-align: right; white-space: nowrap; }
.table-wrap { overflow: auto; max-height: 75vh; }
.section { margin-top: 10px; }
.section-body { padding: 8px; }
@media (max-width: 900px) {
  .grid, .subgrid, .summary-bar { grid-template-columns: 1fr; }
  .stamp { text-align: left; }
  .topbar { align-items: flex-start; flex-direction: column; }
}
@page {
  size: A4 landscape;
  margin: 8mm;
}
@media print {
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    background: #fff;
    color: #111;
    font-size: 8.5px;
    line-height: 1.18;
  }
  .terminal { padding: 0; }
  .topbar {
    border: 1px solid #888;
    border-left: 4px solid var(--accent);
    margin-bottom: 4px;
    padding: 4px 6px;
  }
  h1 { font-size: 12px; }
  .subtitle, .stamp, .metric span, .muted, .na { color: #555 !important; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
  .subgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
  .summary-bar { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; margin: 4px 0; }
  .topbar, .card, .section, .block {
    border-color: #999;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .card h2, .section h2, th {
    border-color: #777;
  }
  .card h2, .section h2 {
    padding: 3px 5px;
    font-size: 10px;
  }
  .card-body, .section-body, .block {
    padding: 4px;
  }
  .block h3 {
    color: #111;
    font-size: 8.5px;
    margin-bottom: 2px;
  }
  .metric { padding: 1px 0; gap: 4px; }
  .pill, .badge {
    background: #fff7df;
    border-color: #9a6a00;
    color: #6f4b00;
    padding: 1px 4px;
  }
  table { font-size: 7.5px; }
  th, td {
    padding: 2px 3px;
    border-color: #ccc;
  }
  tr:nth-child(even) td { background: #f5f7fa; }
  .pos, .state-normal { color: #087a2f !important; }
  .neg, .state-crisis { color: #b00020 !important; }
  .warn, .state-watch, .state-stress { color: #8a4b00 !important; }
  th { position: static; }
  .table-wrap { max-height: none; overflow: visible; }
}
</style>
</head>
<body>
<main class="terminal">
<div class="topbar">
  <div><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(subtitle)}</div></div>
  <div class="stamp">Generated locally<br>Offline static HTML</div>
</div>
${body}
</main>
</body>
</html>`;
}

function value(raw) {
  return raw === null || raw === undefined ? '' : String(raw);
}

function valueOrNa(raw) {
  return raw === null || raw === undefined || raw === '' ? 'N/A' : String(raw);
}

function formatNumber(raw, decimals = 2) {
  const number = optionalNumber(raw);
  if (number === null) return '';
  return number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatPrice(raw) {
  return optionalNumber(raw) === null ? 'N/A' : formatNumber(raw, 2);
}

function formatPremium(asset) {
  const premium = optionalNumber(asset && asset.observed_option_premium);
  if (premium === null) return 'N/A';
  return `${formatNumber(premium, 2)} USD`;
}

function formatPct(raw) {
  const number = optionalNumber(raw);
  if (number === null) return 'N/A';
  return `${formatNumber(number, 2)}%`;
}

function formatHedgePct(raw) {
  const number = optionalNumber(raw);
  if (number === null) return 'N/A';
  return `${formatNumber(number, 0)}%`;
}

function formatGreek(greeks, key) {
  if (!greeks) return 'N/A';
  const number = optionalNumber(greeks[key]);
  return number === null ? 'N/A' : formatNumber(number, 6);
}

function staleWarningMarkdown(asset) {
  if (!asset.stale_warning) return [];
  return [
    'WARNING:',
    '',
    `Metrics are based on data as of: ${asset.stale_warning.data_as_of}`,
    '',
    `Snapshot date: ${asset.stale_warning.snapshot_date}`,
    '',
    'Data may be stale.',
    'Trade recommendations may be blocked by circuit breakers.',
    ''
  ];
}

function premiumNoteMarkdown(asset) {
  const status = asset && asset.premium_status;
  if (status === 'INDICATIVE_DERIBIT') {
    return ['  (Indicative research price, not an executable Bybit quote.)'];
  }
  return [];
}

function optionWarningsMarkdown(asset) {
  if (!Array.isArray(asset.option_warnings) || asset.option_warnings.length === 0) return [];
  return asset.option_warnings.map(warning => `- Option warning: ${warning}`);
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entryPath);
    }
  }
  return files;
}

function loadArchivedSnapshots() {
  const snapshotsByDate = new Map();
  for (const filePath of listJsonFiles(SNAPSHOT_DIR)) {
    let payload = null;
    try {
      payload = readJson(filePath);
    } catch (error) {
      continue;
    }
    if (!payload || !Array.isArray(payload.assets) || !payload.snapshot_date) continue;
    const existing = snapshotsByDate.get(payload.snapshot_date);
    const isDaily = String(payload.requested_mode || '').toLowerCase() === 'daily';
    const existingIsDaily = existing && String(existing.snapshot.requested_mode || '').toLowerCase() === 'daily';
    const generatedAt = new Date(payload.generated_at || 0).getTime();
    const existingGeneratedAt = existing ? new Date(existing.snapshot.generated_at || 0).getTime() : -Infinity;
    if (!existing || (isDaily && !existingIsDaily) || (isDaily === existingIsDaily && generatedAt >= existingGeneratedAt)) {
      snapshotsByDate.set(payload.snapshot_date, {
        snapshot: payload,
        source: path.relative(REPO_ROOT, filePath)
      });
    }
  }
  return [...snapshotsByDate.values()].sort((a, b) => a.snapshot.snapshot_date.localeCompare(b.snapshot.snapshot_date));
}

function timelineWarnings(asset) {
  const warnings = [];
  if (asset.stale_warning) {
    warnings.push(`Stale data: source=${asset.stale_warning.data_as_of}, snapshot=${asset.stale_warning.snapshot_date}`);
  }
  if (Array.isArray(asset.option_warnings)) warnings.push(...asset.option_warnings);
  if (Array.isArray(asset.circuit_breaker_reasons)) {
    warnings.push(...asset.circuit_breaker_reasons.map(reason => `Circuit breaker: ${reason}`));
  }
  return dedupeWarnings(warnings);
}

function tableSafe(value) {
  const raw = value === null || value === undefined || value === '' ? 'N/A' : String(value);
  return raw.replace(/\|/g, '/').replace(/\r?\n/g, ' ');
}

function regimeHistory(rows, asset) {
  return rows
    .filter(row => row.asset === asset)
    .map(row => `${row.date}: ${row.regime}`)
    .join('; ') || 'N/A';
}

function hedgeTargetChanges(rows) {
  const changes = [];
  for (const asset of ASSETS.map(config => config.asset)) {
    let prior = null;
    for (const row of rows.filter(item => item.asset === asset)) {
      if (prior !== null && row.target_hedge_pct !== prior) {
        changes.push(`${row.date} ${asset}: ${formatHedgePct(prior)} -> ${formatHedgePct(row.target_hedge_pct)}`);
      }
      prior = row.target_hedge_pct;
    }
  }
  return changes.length ? changes.join('; ') : 'N/A';
}

function staleFallbackDates(rows) {
  return [...new Set(rows
    .filter(row => row.warnings.some(warning => warning.toLowerCase().includes('stale') || warning.toLowerCase().includes('fallback')))
    .map(row => row.date))]
    .sort();
}

function staleFallbackSummaryMarkdown(rows) {
  const dates = staleFallbackDates(rows);
  if (!dates.length) return ['- No stale/fallback days detected.'];
  return [
    '- Stale/fallback days:',
    ...dates.map(date => `  - ${date}`)
  ];
}

function staleFallbackSummaryHtml(rows) {
  const dates = staleFallbackDates(rows);
  if (!dates.length) return '<div class="pos">No stale/fallback days detected</div>';
  return `<div class="warn">Stale/fallback days:</div><ul class="warning-list">${dates.map(date => `<li>${escapeHtml(date)}</li>`).join('')}</ul>`;
}

function buildTimelineRows(archives) {
  const rows = [];
  for (const archive of archives) {
    for (const asset of archive.snapshot.assets) {
      rows.push({
        date: archive.snapshot.snapshot_date,
        asset: asset.asset,
        current_price: optionalNumber(asset.current_spot_price, asset.spot_price),
        regime: asset.alert_state || asset.damage_state || null,
        target_hedge_pct: optionalNumber(asset.target_hedge_pct),
        current_hedge_pct: optionalNumber(asset.current_hedge_pct),
        today_action: asset.today_action || null,
        execution_state: asset.execution_state || null,
        option_expiry: asset.short_call_expiry || asset.option_expiry || null,
        dte: optionalNumber(asset.days_to_expiry, asset.days_to_expiration),
        strike: optionalNumber(asset.short_call_strike, asset.OTM05_target_strike),
        premium_status: asset.premium_status || null,
        premium_source: asset.option_premium_source || null,
        cycle_underlying_pnl: optionalNumber(asset.cycle_underlying_pnl, asset.current_cycle_accounting && asset.current_cycle_accounting.underlying_pnl_since_cycle_open),
        cycle_option_pnl: optionalNumber(asset.cycle_option_pnl, asset.current_cycle_accounting && asset.current_cycle_accounting.option_pnl_current_cycle),
        cycle_hedge_pnl: optionalNumber(asset.cycle_hedge_pnl, asset.current_cycle_accounting && asset.current_cycle_accounting.hedge_pnl_current_cycle),
        net_cycle_pnl: optionalNumber(asset.net_cycle_pnl, asset.current_cycle_accounting && asset.current_cycle_accounting.net_cycle_pnl),
        portfolio_underlying_pnl: optionalNumber(asset.portfolio_underlying_pnl, asset.portfolio_lifetime_accounting && asset.portfolio_lifetime_accounting.underlying_pnl_since_original_spot_purchase, asset.underlying_unrealized_pnl),
        portfolio_option_pnl: optionalNumber(asset.portfolio_option_pnl, asset.portfolio_lifetime_accounting && asset.portfolio_lifetime_accounting.current_option_pnl, asset.option_unrealized_pnl_approx, asset.option_mtm_pnl),
        portfolio_hedge_pnl: optionalNumber(asset.portfolio_hedge_pnl, asset.portfolio_lifetime_accounting && asset.portfolio_lifetime_accounting.current_hedge_pnl, asset.hedge_unrealized_pnl_approx),
        portfolio_net_pnl: optionalNumber(asset.portfolio_net_pnl, asset.portfolio_lifetime_accounting && asset.portfolio_lifetime_accounting.portfolio_net_pnl, asset.net_unrealized_pnl_approx),
        warnings: timelineWarnings(asset),
        source: archive.source
      });
    }
  }
  return rows.sort((a, b) => `${a.date}:${a.asset}`.localeCompare(`${b.date}:${b.asset}`));
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(tableSafe).join(' | ')} |`)
  ];
}

function renderTimelineAssetTable(rows, asset) {
  const assetRows = rows.filter(row => row.asset === asset);
  if (!assetRows.length) return [`### ${asset}`, '', 'No archived rows.', ''];
  return [
    `### ${asset}`,
    '',
    ...markdownTable(
      ['Date', 'Price', 'Regime', 'Target', 'Current', 'Action', 'Exec', 'DTE', 'Strike', 'Net Cycle PnL', 'Portfolio Net PnL', 'Warnings'],
      assetRows.map(row => [
        row.date,
        formatPrice(row.current_price),
        row.regime || 'N/A',
        formatHedgePct(row.target_hedge_pct),
        formatHedgePct(row.current_hedge_pct),
        row.today_action || 'N/A',
        row.execution_state || 'N/A',
        valueOrNa(row.dte),
        formatPrice(row.strike),
        formatPrice(row.net_cycle_pnl),
        formatPrice(row.portfolio_net_pnl),
        row.warnings.length ? row.warnings.join('; ') : 'N/A'
      ])
    ),
    ''
  ];
}

function timelineCsvRows(rows) {
  return rows.map(row => ({
    date: row.date,
    asset: row.asset,
    current_price: row.current_price,
    regime: row.regime,
    target_hedge_pct: row.target_hedge_pct,
    current_hedge_pct: row.current_hedge_pct,
    today_action: row.today_action,
    execution_state: row.execution_state,
    option_expiry: row.option_expiry,
    dte: row.dte,
    strike: row.strike,
    premium_status: row.premium_status,
    premium_source: row.premium_source,
    cycle_underlying_pnl: row.cycle_underlying_pnl,
    cycle_option_pnl: row.cycle_option_pnl,
    cycle_hedge_pnl: row.cycle_hedge_pnl,
    net_cycle_pnl: row.net_cycle_pnl,
    portfolio_underlying_pnl: row.portfolio_underlying_pnl,
    portfolio_option_pnl: row.portfolio_option_pnl,
    portfolio_hedge_pnl: row.portfolio_hedge_pnl,
    portfolio_net_pnl: row.portfolio_net_pnl,
    warnings: row.warnings.join('; '),
    source: row.source
  }));
}

function timelineMetadata(archives, generatedAt = new Date()) {
  const latest = archives.length ? archives[archives.length - 1].snapshot : null;
  const timezone = latest && latest.timezone ? latest.timezone : 'America/New_York';
  return {
    snapshot_date: latest ? latest.snapshot_date : null,
    decision_timestamp: latest ? latest.decision_timestamp : null,
    generated_at: generatedAt.toISOString(),
    generated_at_local: localTimestamp(generatedAt, timezone),
    account_sync_last_sync: latest ? latest.account_sync_last_sync || accountSyncLastSyncFromAssets(latest.assets) : null,
    run_mode: latest ? latest.run_mode || latest.mode : null,
    timezone
  };
}

function writeTextWithFallback(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  } catch (error) {
    if (error && (error.code === 'EBUSY' || error.code === 'EPERM')) {
      const fallbackPath = filePath.replace(/(\.[^.]+)$/, '.next$1');
      fs.writeFileSync(fallbackPath, content, 'utf8');
      console.warn(`Could not write locked file ${path.relative(REPO_ROOT, filePath)}; wrote ${path.relative(REPO_ROOT, fallbackPath)} instead.`);
      return fallbackPath;
    }
    throw error;
  }
}

function renderPositionTimeline() {
  const archives = loadArchivedSnapshots();
  const rows = buildTimelineRows(archives);
  const dates = [...new Set(rows.map(row => row.date))].sort();
  const metadata = timelineMetadata(archives);

  return [
    '# Live Position Timeline',
    '',
    ...snapshotMetadataMarkdown(metadata),
    '- Source: archived live snapshots and position artifacts only.',
    '- Status: read-only accounting view; no orders placed.',
    '',
    '## Summary',
    '',
    `- Number of archived days: ${dates.length}.`,
    `- First snapshot date: ${dates[0] || 'N/A'}.`,
    `- Latest snapshot date: ${dates[dates.length - 1] || 'N/A'}.`,
    `- Spreadsheet view: live/LIVE_POSITION_TIMELINE.csv.`,
    `- BTC regime history: ${regimeHistory(rows, 'BTC')}.`,
    `- ETH regime history: ${regimeHistory(rows, 'ETH')}.`,
    `- Hedge target changes: ${hedgeTargetChanges(rows)}.`,
    ...staleFallbackSummaryMarkdown(rows),
    '',
    '## Daily Overview',
    '',
    ...markdownTable(
      ['Date', 'Asset', 'Price', 'Regime', 'Target', 'Current', 'Exec', 'DTE', 'Cycle Underlying PnL', 'Cycle Option PnL', 'Cycle Hedge PnL', 'Net Cycle PnL', 'Portfolio Underlying PnL', 'Portfolio Net PnL'],
      rows.map(row => [
        row.date,
        row.asset,
        formatPrice(row.current_price),
        row.regime || 'N/A',
        formatHedgePct(row.target_hedge_pct),
        formatHedgePct(row.current_hedge_pct),
        row.execution_state || 'N/A',
        valueOrNa(row.dte),
        formatPrice(row.cycle_underlying_pnl),
        formatPrice(row.cycle_option_pnl),
        formatPrice(row.cycle_hedge_pnl),
        formatPrice(row.net_cycle_pnl),
        formatPrice(row.portfolio_underlying_pnl),
        formatPrice(row.portfolio_net_pnl)
      ])
    ),
    '',
    '## By Asset',
    '',
    ...ASSETS.flatMap(assetConfig => renderTimelineAssetTable(rows, assetConfig.asset)),
    '## Premium Source Detail',
    '',
    ...markdownTable(
      ['Date', 'Asset', 'Expiry', 'Strike', 'Premium Status', 'Premium Source'],
      rows.map(row => [
        row.date,
        row.asset,
        row.option_expiry || 'N/A',
        formatPrice(row.strike),
        row.premium_status || 'N/A',
        row.premium_source || 'N/A'
      ])
    ),
    '',
    '## Notes',
    '',
    '- Current Cycle Accounting uses the cycle underlying reference price plus current option and hedge marks.',
    '- Portfolio / Lifetime Accounting uses the original spot purchase cost basis plus current option and hedge marks.',
    '- Option marks come from archived live position monitoring when available; no theoretical option model is used.',
    '- Missing fields remain N/A.'
  ].join('\n');
}

function renderTimelineHtml() {
  const archives = loadArchivedSnapshots();
  const rows = buildTimelineRows(archives);
  const dates = [...new Set(rows.map(row => row.date))].sort();
  const metadata = timelineMetadata(archives);
  const body = [
    '<section class="section"><h2>Execution Metadata</h2><div class="section-body summary-bar">',
    ...snapshotMetadataHtmlBlocks(metadata),
    '</div></section>',
    '<section class="section"><h2>Summary</h2><div class="section-body summary-bar">',
    `<div class="block"><h3>Archive</h3>${htmlMetric('Archived days', dates.length)}${htmlMetric('First date', dates[0] || 'N/A')}${htmlMetric('Latest date', dates[dates.length - 1] || 'N/A')}</div>`,
    `<div class="block"><h3>BTC Regime</h3><div>${escapeHtml(regimeHistory(rows, 'BTC'))}</div></div>`,
    `<div class="block"><h3>ETH Regime</h3><div>${escapeHtml(regimeHistory(rows, 'ETH'))}</div></div>`,
    `<div class="block"><h3>Changes</h3>${htmlMetric('Hedge target changes', hedgeTargetChanges(rows))}${staleFallbackSummaryHtml(rows)}</div>`,
    '</div></section>',
    '<section class="section"><h2>Daily Position Timeline</h2><div class="section-body table-wrap">',
    '<table>',
    '<thead><tr><th>Date</th><th>Asset</th><th class="num">Price</th><th>Regime</th><th class="num">Target</th><th class="num">Current</th><th>Today Action</th><th>Execution</th><th>Expiry</th><th class="num">DTE</th><th class="num">Strike</th><th>Premium Status/Source</th><th class="num">Cycle Underlying PnL</th><th class="num">Cycle Option PnL</th><th class="num">Cycle Hedge PnL</th><th class="num">Net Cycle PnL</th><th class="num">Portfolio Underlying PnL</th><th class="num">Portfolio Net PnL</th><th>Warnings</th></tr></thead>',
    '<tbody>',
    ...rows.map(row => `<tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.asset)}</td>
      <td class="num">${escapeHtml(formatPrice(row.current_price))}</td>
      <td class="${stateClass(row.regime)}">${escapeHtml(row.regime || 'N/A')}</td>
      <td class="num">${escapeHtml(formatHedgePct(row.target_hedge_pct))}</td>
      <td class="num">${escapeHtml(formatHedgePct(row.current_hedge_pct))}</td>
      <td>${escapeHtml(row.today_action || 'N/A')}</td>
      <td class="${stateClass(row.execution_state)}">${escapeHtml(row.execution_state || 'N/A')}</td>
      <td>${escapeHtml(row.option_expiry || 'N/A')}</td>
      <td class="num">${escapeHtml(valueOrNa(row.dte))}</td>
      <td class="num">${escapeHtml(formatPrice(row.strike))}</td>
      <td>${escapeHtml(`${row.premium_status || 'N/A'} / ${row.premium_source || 'N/A'}`)}</td>
      <td class="num ${pnlClass(row.cycle_underlying_pnl)}">${escapeHtml(formatPrice(row.cycle_underlying_pnl))}</td>
      <td class="num ${pnlClass(row.cycle_option_pnl)}">${escapeHtml(formatPrice(row.cycle_option_pnl))}</td>
      <td class="num ${pnlClass(row.cycle_hedge_pnl)}">${escapeHtml(formatPrice(row.cycle_hedge_pnl))}</td>
      <td class="num ${pnlClass(row.net_cycle_pnl)}">${escapeHtml(formatPrice(row.net_cycle_pnl))}</td>
      <td class="num ${pnlClass(row.portfolio_underlying_pnl)}">${escapeHtml(formatPrice(row.portfolio_underlying_pnl))}</td>
      <td class="num ${pnlClass(row.portfolio_net_pnl)}">${escapeHtml(formatPrice(row.portfolio_net_pnl))}</td>
      <td class="${row.warnings.length ? 'warn' : 'muted'}">${escapeHtml(row.warnings.length ? row.warnings.join('; ') : 'N/A')}</td>
    </tr>`),
    '</tbody></table></div></section>'
  ].join('\n');
  return htmlShell('Live Position Timeline', `${dates[0] || 'N/A'} to ${dates[dates.length - 1] || 'N/A'}`, body);
}

function writePositionTimeline() {
  const timeline = renderPositionTimeline();
  const timelinePath = writeTextWithFallback(LIVE_POSITION_TIMELINE_PATH, `${timeline}\n`);
  writeTextWithFallback(LIVE_POSITION_TIMELINE_HTML_PATH, `${renderTimelineHtml()}\n`);
  const archives = loadArchivedSnapshots();
  const rows = buildTimelineRows(archives);
  writeTextWithFallback(LIVE_POSITION_TIMELINE_CSV_PATH, `${objectsToCsv(timelineCsvRows(rows), [
    'date',
    'asset',
    'current_price',
    'regime',
    'target_hedge_pct',
    'current_hedge_pct',
    'today_action',
    'execution_state',
    'option_expiry',
    'dte',
    'strike',
    'premium_status',
    'premium_source',
    'cycle_underlying_pnl',
    'cycle_option_pnl',
    'cycle_hedge_pnl',
    'net_cycle_pnl',
    'portfolio_underlying_pnl',
    'portfolio_option_pnl',
    'portfolio_hedge_pnl',
    'portfolio_net_pnl',
    'warnings',
    'source'
  ])}\n`, 'utf8');
  return timelinePath;
}

function ensureLiveFiles() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const readmePath = path.join(LIVE_DIR, 'README.md');
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, [
      '# Live Research',
      '',
      'This folder contains research-grade manual execution aids for the CCW Dynamic Hedge Overlay.',
      '',
      '- `snapshots/` stores read-only BTC/ETH live research snapshots.',
      '- `manual_decision_log_template.csv` provides an auditable manual logging schema.',
      '',
      'These files do not place orders and do not validate live economic superiority.'
    ].join('\n'));
  }

  const templatePath = path.join(LIVE_DIR, 'manual_decision_log_template.csv');
  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, objectsToCsv([], MANUAL_LOG_COLUMNS));
  }
}

function writeSnapshot(snapshot) {
  ensureLiveFiles();
  const baseName = snapshot.output_basename;
  if (!baseName) {
    throw new Error('Missing output_basename; refusing to write ambiguous legacy live_snapshot output.');
  }
  const jsonPath = path.join(SNAPSHOT_DIR, `${baseName}.json`);
  const mdPath = path.join(SNAPSHOT_DIR, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  fs.writeFileSync(mdPath, `${renderMarkdown(snapshot)}\n`);
  const activeReportPath = snapshot.requested_mode === 'daily'
    ? writeActiveDailyReport(snapshot)
    : null;
  const archive = writeVersionedDailySnapshot(snapshot, { jsonPath, mdPath, activeReportPath });
  return { jsonPath, mdPath, activeReportPath, archive };
}

function writeActiveDailyReport(snapshot) {
  const report = renderActiveMonitoringReport(snapshot);
  fs.writeFileSync(ACTIVE_DAILY_REPORT_PATH, `${report}\n`, 'utf8');
  fs.writeFileSync(ACTIVE_DAILY_REPORT_HTML_PATH, `${renderActiveMonitoringHtml(snapshot)}\n`, 'utf8');
  return ACTIVE_DAILY_REPORT_PATH;
}

function copyIfExists(sourcePath, targetPath, manifest, label, snapshotDate) {
  if (!fs.existsSync(sourcePath)) {
    manifest.warnings.push(`Missing ${label}: ${path.relative(REPO_ROOT, sourcePath)}.`);
    return;
  }
  fs.copyFileSync(sourcePath, targetPath);
  manifest.files.push({
    label,
    source: path.relative(REPO_ROOT, sourcePath),
    archived_as: path.relative(REPO_ROOT, targetPath)
  });
  warnIfArtifactDateMismatch(sourcePath, manifest, label, snapshotDate);
}

function warnIfArtifactDateMismatch(sourcePath, manifest, label, snapshotDate) {
  if (!snapshotDate || path.extname(sourcePath).toLowerCase() !== '.json') return;
  let payload = null;
  try {
    payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (error) {
    manifest.warnings.push(`Could not inspect ${label} for stale data: ${error.message}.`);
    return;
  }

  const dates = new Set();
  if (payload && payload.data_as_of) dates.add(payload.data_as_of);
  if (payload && payload.snapshot_date) dates.add(payload.snapshot_date);
  if (payload && Array.isArray(payload.rows)) {
    for (const row of payload.rows) {
      if (row && row.data_as_of) dates.add(row.data_as_of);
      if (row && row.snapshot_date) dates.add(row.snapshot_date);
      if (row && row.date) dates.add(row.date);
    }
  }
  const observedDates = [...dates].filter(Boolean);
  const staleDates = observedDates.filter(date => date !== snapshotDate);
  if (staleDates.length) {
    manifest.warnings.push(`${label} has data date(s) ${[...new Set(staleDates)].join(', ')}; snapshot_date is ${snapshotDate}.`);
  }
}

function writeVersionedDailySnapshot(snapshot, outputs) {
  const dailyDir = path.join(SNAPSHOT_DIR, snapshot.snapshot_date);
  fs.mkdirSync(dailyDir, { recursive: true });

  const manifest = {
    generated_at: new Date().toISOString(),
    snapshot_date: snapshot.snapshot_date,
    mode: snapshot.mode,
    output_basename: snapshot.output_basename,
    files: [],
    warnings: []
  };

  copyIfExists(outputs.jsonPath, path.join(dailyDir, `${snapshot.output_basename}.json`), manifest, 'snapshot_json', snapshot.snapshot_date);
  copyIfExists(outputs.mdPath, path.join(dailyDir, `${snapshot.output_basename}.md`), manifest, 'snapshot_markdown', snapshot.snapshot_date);
  if (outputs.activeReportPath) {
    copyIfExists(outputs.activeReportPath, path.join(dailyDir, 'ACTIVE_MONITORING_DAILY.md'), manifest, 'active_monitoring_daily_report', snapshot.snapshot_date);
    copyIfExists(ACTIVE_DAILY_REPORT_HTML_PATH, path.join(dailyDir, 'ACTIVE_MONITORING_DAILY.html'), manifest, 'active_monitoring_daily_html', snapshot.snapshot_date);
  }

  const artifactPaths = [
    ['btc_live_metrics', path.join(LIVE_DIR, 'data', 'btc_live_metrics.json')],
    ['eth_live_metrics', path.join(LIVE_DIR, 'data', 'eth_live_metrics.json')],
    ['live_monitoring_signals', LIVE_MONITORING_SIGNALS_PATH],
    ['live_option_discovery', LIVE_OPTION_DISCOVERY_PATH],
    ['live_position_monitoring', LIVE_POSITION_MONITORING_PATH],
    ['position_register', POSITION_REGISTER_PATH]
  ];

  for (const [label, sourcePath] of artifactPaths) {
    copyIfExists(sourcePath, path.join(dailyDir, path.basename(sourcePath)), manifest, label, snapshot.snapshot_date);
  }

  const manifestPath = path.join(dailyDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { dailyDir, manifestPath, manifest };
}

function archiveTimeline(timelinePath, archive) {
  if (!timelinePath || !archive || !archive.dailyDir || !fs.existsSync(timelinePath)) return;
  const targetPath = path.join(archive.dailyDir, path.basename(timelinePath));
  fs.copyFileSync(timelinePath, targetPath);
  archive.manifest.files.push({
    label: 'live_position_timeline',
    source: path.relative(REPO_ROOT, timelinePath),
    archived_as: path.relative(REPO_ROOT, targetPath)
  });
  if (fs.existsSync(LIVE_POSITION_TIMELINE_CSV_PATH)) {
    const csvTargetPath = path.join(archive.dailyDir, path.basename(LIVE_POSITION_TIMELINE_CSV_PATH));
    fs.copyFileSync(LIVE_POSITION_TIMELINE_CSV_PATH, csvTargetPath);
    archive.manifest.files.push({
      label: 'live_position_timeline_csv',
      source: path.relative(REPO_ROOT, LIVE_POSITION_TIMELINE_CSV_PATH),
      archived_as: path.relative(REPO_ROOT, csvTargetPath)
    });
  }
  if (fs.existsSync(LIVE_POSITION_TIMELINE_HTML_PATH)) {
    const htmlTargetPath = path.join(archive.dailyDir, path.basename(LIVE_POSITION_TIMELINE_HTML_PATH));
    fs.copyFileSync(LIVE_POSITION_TIMELINE_HTML_PATH, htmlTargetPath);
    archive.manifest.files.push({
      label: 'live_position_timeline_html',
      source: path.relative(REPO_ROOT, LIVE_POSITION_TIMELINE_HTML_PATH),
      archived_as: path.relative(REPO_ROOT, htmlTargetPath)
    });
  }
  fs.writeFileSync(archive.manifestPath, `${JSON.stringify(archive.manifest, null, 2)}\n`, 'utf8');
}

function main() {
  logCcwEnvStartup('generate_live_research_snapshot.js');
  const args = parseArgs(process.argv.slice(2));
  assertArgs(args);

  const now = new Date();
  const snapshotDate = localDateString(now, args.timezone);
  const generatedTime = localTimeCompact(now, args.timezone);
  const liveMonitoringSignals = loadLiveMonitoringSignals(snapshotDate);
  const liveOptionDiscovery = loadLiveOptionDiscovery(snapshotDate);
  const positionRegister = loadActivePositionRegister();
  const livePositionMonitoring = loadLivePositionMonitoring(snapshotDate);
  if ((args.mode === 'daily' || args.mode === 'manual') && positionRegister.positions.size === 0) {
    throw new Error('Active monitoring requires at least one ACTIVE Position Register entry in live/position_register.json.');
  }
  const assets = ASSETS.map(asset => buildAssetSnapshot(asset, args, now, snapshotDate, liveMonitoringSignals, liveOptionDiscovery, positionRegister, livePositionMonitoring));
  const runMode = modeLabel(args.mode);
  const snapshot = {
    generated_at: now.toISOString(),
    generated_at_local: localTimestamp(now, args.timezone),
    snapshot_date: snapshotDate,
    generated_time: generatedTime,
    output_basename: outputBasename(snapshotDate, args.mode, generatedTime),
    mode: runMode,
    run_mode: runMode,
    requested_mode: args.mode,
    venue: args.venue,
    decision_time: args.decisionTime,
    timezone: args.timezone,
    decision_timestamp: decisionTimestamp(now, args),
    account_sync_last_sync: accountSyncLastSyncFromAssets(assets),
    assumptions: {
      hedge_states: HEDGE_BY_STATE,
      target_position_logic: 'delta = target hedge - current hedge',
      same_day_hedge_activation: true,
      normal_exit_rule: 'close only after 2 consecutive normal days',
      read_only: true
    },
    assets
  };

  const outputs = writeSnapshot(snapshot);
  const timelinePath = writePositionTimeline();
  archiveTimeline(timelinePath, outputs.archive);

  console.log('Live research snapshot generated');
  console.log(`Mode: ${snapshot.mode}`);
  console.log(`Decision timestamp: ${snapshot.decision_timestamp}`);
  for (const asset of snapshot.assets) {
    const reasons = asset.circuit_breaker_reasons.length ? ` (${asset.circuit_breaker_reasons.join('; ')})` : '';
    console.log(`${asset.asset}: ${asset.alert_state || 'missing_state'} -> target ${asset.target_hedge_pct}% delta ${asset.executed_delta_recommendation_pct}% ${asset.circuit_breaker_status}${reasons}`);
  }
  console.log(`JSON: ${path.relative(REPO_ROOT, outputs.jsonPath)}`);
  console.log(`MD: ${path.relative(REPO_ROOT, outputs.mdPath)}`);
  if (outputs.activeReportPath) {
    console.log(`Active report: ${path.relative(REPO_ROOT, outputs.activeReportPath)}`);
    console.log(`Active report HTML: ${path.relative(REPO_ROOT, ACTIVE_DAILY_REPORT_HTML_PATH)}`);
  }
  console.log(`Position timeline: ${path.relative(REPO_ROOT, timelinePath)}`);
  console.log(`Position timeline HTML: ${path.relative(REPO_ROOT, LIVE_POSITION_TIMELINE_HTML_PATH)}`);
  console.log(`Daily archive: ${path.relative(REPO_ROOT, outputs.archive.dailyDir)}`);
  if (outputs.archive.manifest.warnings.length) {
    console.log(`Archive warnings: ${outputs.archive.manifest.warnings.join('; ')}`);
  }
}

function outputBasename(snapshotDate, requestedMode, generatedTime) {
  if (requestedMode === 't0') return `${snapshotDate}_t0_discovery_snapshot`;
  if (requestedMode === 'daily') return `${snapshotDate}_daily_monitoring_snapshot`;
  if (requestedMode === 'manual') return `${snapshotDate}_${generatedTime}_NY_manual_monitoring_snapshot`;
  throw new Error(`No snapshot output naming rule for mode=${requestedMode}.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error generating live research snapshot: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
