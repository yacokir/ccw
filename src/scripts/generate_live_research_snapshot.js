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
    signalPath: path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv')
  },
  {
    asset: 'ETH',
    currentHedgeArg: 'ethCurrentHedge',
    normalCounterArg: 'ethNormalCounter',
    dailyMtmPaths: [
      path.join(OUTPUT_DIR, 'daily_mtm', 'eth_weekly_otm05_2025', 'eth_weekly_otm05_2025_daily_mtm.json')
    ],
    signalPath: path.join(OUTPUT_DIR, 'daily_mtm', 'eth_hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv')
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
  if (!['t0', 'daily'].includes(args.mode)) {
    throw new Error(`Invalid --mode=${args.mode}. Expected --mode=t0 or --mode=daily.`);
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

function parseInstrument(instrumentName) {
  if (!instrumentName) return { expiry: null, strike: null };
  const parts = String(instrumentName).split('-');
  if (parts.length < 4) return { expiry: null, strike: null };
  return {
    expiry: parts[1],
    strike: optionalNumber(parts[2])
  };
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
  if (fields.marketDataAbnormal) reasons.push('Market data abnormal');

  return {
    status: reasons.length ? 'NO_TRADE' : 'OK',
    reasons
  };
}

function buildAssetSnapshot(assetConfig, args, now, snapshotDate) {
  const { rows, sources } = loadDailyRows(assetConfig);
  const { signals, source: signalSource } = loadSignals(assetConfig);
  const dailyRow = latestRowOnOrBefore(rows, snapshotDate);
  const signalRow = dailyRow ? signals.get(dailyRow.date) : null;
  const parsedInstrument = parseInstrument(dailyRow && dailyRow.instrument_name);
  const stale = isStale(dailyRow && dailyRow.date, snapshotDate);
  const signalStale = Boolean(signalRow && signalRow.date !== snapshotDate);
  const spotPrice = optionalNumber(dailyRow && dailyRow.underlying_price);
  const currentHedge = optionalNumber(args[assetConfig.currentHedgeArg]) ?? 0;
  const normalCounter = optionalNumber(args[assetConfig.normalCounterArg]) ?? 0;
  const alertState = signalRow ? signalRow.alert_state : null;
  const damageState = signalRow ? signalRow.damage_state : null;
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
    ewma: optionalNumber(dailyRow && dailyRow.EWMA_vol_pct, signalRow && signalRow.ewma_vol_pct),
    historicalVaR: optionalNumber(dailyRow && dailyRow.historical_VaR_pct),
    optionExpiry: parsedInstrument.expiry,
    optionStrike: parsedInstrument.strike,
    marketDataAbnormal: Boolean(dailyRow && dailyRow.notes && String(dailyRow.notes).includes('suspicious'))
  });

  const targetHedge = breaker.status === 'OK' ? hysteresis.targetHedge : currentHedge;
  const executedDeltaRecommendation = roundNumber(targetHedge - currentHedge);

  return {
    asset: assetConfig.asset,
    venue: args.venue,
    timestamp: decisionTimestamp(now, args),
    snapshot_date: snapshotDate,
    data_as_of: dailyRow ? dailyRow.date : null,
    spot_price: roundNumber(spotPrice),
    return_7d_pct: roundNumber(spotReturnPct(dailyRow, rowDaysBefore(rows, dailyRow && dailyRow.date, 7))),
    return_30d_pct: roundNumber(spotReturnPct(dailyRow, rowDaysBefore(rows, dailyRow && dailyRow.date, 30))),
    return_90d_pct: roundNumber(spotReturnPct(dailyRow, rowDaysBefore(rows, dailyRow && dailyRow.date, 90))),
    realized_vol_30d_pct: realizedVol30d(rows, dailyRow && dailyRow.date),
    EWMA_pct: roundNumber(optionalNumber(dailyRow && dailyRow.EWMA_vol_pct, signalRow && signalRow.ewma_vol_pct)),
    historical_VaR_pct: roundNumber(optionalNumber(dailyRow && dailyRow.historical_VaR_pct)),
    damage_state: damageState,
    alert_state: alertState,
    option_expiry: parsedInstrument.expiry,
    OTM05_target_strike: parsedInstrument.strike,
    observed_option_premium: roundNumber(optionalNumber(dailyRow && dailyRow.option_price_proxy)),
    current_hedge_pct: currentHedge,
    target_hedge_pct: targetHedge,
    executed_delta_recommendation_pct: executedDeltaRecommendation,
    normal_counter: hysteresis.resultingNormalCounter,
    circuit_breaker_status: breaker.status,
    circuit_breaker_reasons: breaker.reasons,
    comments: [
      'Research-grade read-only snapshot; no orders placed.',
      hysteresis.hysteresisNote,
      signalSource ? `Monitoring source: ${signalSource}.` : 'No monitoring signal source available for this asset.',
      sources.length ? `Daily MTM source count: ${sources.length}.` : 'No Daily MTM source available.'
    ].join(' '),
    source_files: {
      daily_mtm: sources,
      monitoring_signal: signalSource
    }
  };
}

function renderMarkdown(snapshot) {
  const rows = snapshot.assets.map(asset => [
    asset.asset,
    asset.data_as_of || '',
    value(asset.spot_price),
    asset.damage_state || '',
    asset.alert_state || '',
    value(asset.current_hedge_pct),
    value(asset.target_hedge_pct),
    value(asset.executed_delta_recommendation_pct),
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
    '| Asset | Data As Of | Spot | Damage | Alert | Current Hedge % | Target Hedge % | Delta Recommendation % | Circuit Breaker | Reasons |',
    '| --- | --- | ---: | --- | --- | ---: | ---: | ---: | --- | --- |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Details',
    '',
    ...snapshot.assets.flatMap(asset => [
      `### ${asset.asset}`,
      '',
      `- Spot price: ${value(asset.spot_price)}.`,
      `- 7d / 30d / 90d return: ${value(asset.return_7d_pct)}% / ${value(asset.return_30d_pct)}% / ${value(asset.return_90d_pct)}%.`,
      `- 30d realized volatility: ${value(asset.realized_vol_30d_pct)}%.`,
      `- EWMA: ${value(asset.EWMA_pct)}%.`,
      `- Historical VaR: ${value(asset.historical_VaR_pct)}%.`,
      `- Option expiry / OTM05 target strike / observed premium: ${asset.option_expiry || ''} / ${value(asset.OTM05_target_strike)} / ${value(asset.observed_option_premium)}.`,
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
  const baseName = `${snapshot.snapshot_date}_live_snapshot`;
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
  const snapshot = {
    generated_at: now.toISOString(),
    snapshot_date: snapshotDate,
    mode: args.mode,
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
    assets: ASSETS.map(asset => buildAssetSnapshot(asset, args, now, snapshotDate))
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

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error generating live research snapshot: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
