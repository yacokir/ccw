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

const LIVE_DIR = path.join(REPO_ROOT, 'live');
const SNAPSHOT_DIR = path.join(LIVE_DIR, 'snapshots');
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
  const active = positions.filter(position => String(position.status || '').toUpperCase() === 'ACTIVE');
  return {
    positions: new Map(active.filter(position => position.asset).map(position => [position.asset, position])),
    source: path.relative(REPO_ROOT, POSITION_REGISTER_PATH),
    missing: false
  };
}

function loadLivePositionMonitoring(snapshotDate) {
  if (!fs.existsSync(LIVE_POSITION_MONITORING_PATH)) return new Map();
  const payload = readJson(LIVE_POSITION_MONITORING_PATH);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return new Map(rows
    .filter(row => row.asset && row.data_as_of === snapshotDate)
    .map(row => [row.asset, row]));
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
  const positionMonitoringRow = monitoringMode ? livePositionMonitoring.get(assetConfig.asset) || null : null;
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
    option_expiry: optionExpiry,
    days_to_expiration: positionRow ? daysBetween(snapshotDate, optionExpiry) : selectedOptionRow ? optionalNumber(liveOptionRow.days_to_expiration) : null,
    OTM05_target_strike: optionStrike,
    selected_option_instrument: optionInstrument,
    position_register_source: positionRow ? positionRegister.source : null,
    cycle_id: positionRow ? positionRow.cycle_id : null,
    underlying_qty: positionRow ? optionalNumber(positionRow.underlying_qty) : null,
    option_qty: positionRow ? optionalNumber(positionRow.option_qty) : null,
    option_entry_premium: positionRow ? optionalNumber(positionRow.option_entry_premium) : null,
    hedge_instrument: positionRow ? positionRow.hedge_instrument : null,
    hedge_qty: positionRow ? optionalNumber(positionRow.hedge_qty) : null,
    hedge_entry_price: positionRow ? optionalNumber(positionRow.hedge_entry_price) : null,
    distance_to_strike_pct: spotPrice === null || optionStrike === null || spotPrice === 0 ? null : roundNumber((optionStrike / spotPrice - 1) * 100),
    observed_option_premium: roundNumber(optionPremium),
    option_data_source: positionMonitoringRow ? path.relative(REPO_ROOT, LIVE_POSITION_MONITORING_PATH) : selectedOptionRow ? path.relative(REPO_ROOT, LIVE_OPTION_DISCOVERY_PATH) : 'historical_daily_mtm',
    option_premium_source: optionPremiumSource,
    premium_status: premiumStatusFor(optionPremiumSource, optionPremium),
    option_bid: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_bid)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_bid)) : null,
    option_ask: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_ask)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_ask)) : null,
    option_mark_price: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_mark_price)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_mark_price)) : null,
    option_last_price: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_last_price)) : selectedOptionRow ? roundNumber(optionalNumber(liveOptionRow.option_last_price)) : null,
    option_greeks: positionMonitoringRow && positionMonitoringRow.greeks ? positionMonitoringRow.greeks : null,
    option_mtm_pnl: positionMonitoringRow ? roundNumber(optionalNumber(positionMonitoringRow.option_mtm_pnl)) : null,
    option_warnings: optionWarnings,
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
    `- Mode: ${snapshot.mode}.`,
    `- Venue: ${snapshot.venue}.`,
    `- Decision timestamp: ${snapshot.decision_timestamp}.`,
    `- Generated at: ${snapshot.generated_at}.`,
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
      `- Option qty: ${value(asset.option_qty)}.`,
      `- Option entry premium: ${formatPrice(asset.option_entry_premium)}.`,
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

function value(raw) {
  return raw === null || raw === undefined ? '' : String(raw);
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

function ensureLiveFiles() {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

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
  return { jsonPath, mdPath };
}

function main() {
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
  const snapshot = {
    generated_at: now.toISOString(),
    snapshot_date: snapshotDate,
    generated_time: generatedTime,
    output_basename: outputBasename(snapshotDate, args.mode, generatedTime),
    mode: modeLabel(args.mode),
    requested_mode: args.mode,
    venue: args.venue,
    decision_time: args.decisionTime,
    timezone: args.timezone,
    decision_timestamp: decisionTimestamp(now, args),
    assumptions: {
      hedge_states: HEDGE_BY_STATE,
      target_position_logic: 'delta = target hedge - current hedge',
      same_day_hedge_activation: true,
      normal_exit_rule: 'close only after 2 consecutive normal days',
      read_only: true
    },
    assets: ASSETS.map(asset => buildAssetSnapshot(asset, args, now, snapshotDate, liveMonitoringSignals, liveOptionDiscovery, positionRegister, livePositionMonitoring))
  };

  const outputs = writeSnapshot(snapshot);

  console.log('Live research snapshot generated');
  console.log(`Mode: ${snapshot.mode}`);
  console.log(`Decision timestamp: ${snapshot.decision_timestamp}`);
  for (const asset of snapshot.assets) {
    const reasons = asset.circuit_breaker_reasons.length ? ` (${asset.circuit_breaker_reasons.join('; ')})` : '';
    console.log(`${asset.asset}: ${asset.alert_state || 'missing_state'} -> target ${asset.target_hedge_pct}% delta ${asset.executed_delta_recommendation_pct}% ${asset.circuit_breaker_status}${reasons}`);
  }
  console.log(`JSON: ${path.relative(REPO_ROOT, outputs.jsonPath)}`);
  console.log(`MD: ${path.relative(REPO_ROOT, outputs.mdPath)}`);
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
