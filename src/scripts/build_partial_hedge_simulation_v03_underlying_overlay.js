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
  percentile,
  sampleStdDev,
  mean,
  yearsBetween
} = require('./btc_deep_risk_utils');

const LAMBDA = 0.94;
const STRESS_LEVELS = [0.10, 0.20, 0.25, 0.30];
const CRISIS_LEVELS = [0.40, 0.50, 0.60];

const YEARS = [
  ['2020', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020', 'btc_weekly_otm05_2020_daily_mtm.json')],
  ['2021', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021', 'btc_weekly_otm05_2021_daily_mtm.json')],
  ['2022', 'Bear market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022', 'btc_weekly_otm05_2022_daily_mtm.json')],
  ['2023', 'Recovery', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023', 'btc_weekly_otm05_2023_daily_mtm.json')],
  ['2024', 'ETF/Bull', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024', 'btc_weekly_otm05_2024_daily_mtm.json')],
  ['2025', 'Mixed', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')]
].map(([year, regime, input]) => ({ year: Number(year), regime, input }));

const SIGNALS_PATH = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv');
const V02_GRID_PATH = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_simulation_v02_grid', 'grid_summary.csv');
const OUTPUT_DIR_V03 = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_simulation_v03_underlying_overlay');

const OUTPUT_GRID_CSV = path.join(OUTPUT_DIR_V03, 'grid_summary.csv');
const OUTPUT_GRID_JSON = path.join(OUTPUT_DIR_V03, 'grid_summary.json');
const OUTPUT_COMPARISON_CSV = path.join(OUTPUT_DIR_V03, 'comparison_vs_v02.csv');
const OUTPUT_COMPARISON_JSON = path.join(OUTPUT_DIR_V03, 'comparison_vs_v02.json');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR_V03, 'findings.md');

const GRID_COLUMNS = [
  'configId',
  'stressHedgePct',
  'crisisHedgePct',
  'validReturnDays',
  'underlyingReturnDays',
  'missingUnderlyingReturnDays',
  'totalReturnPct',
  'CAGRpct',
  'maxDrawdownPct',
  'maxUnderwaterDurationDays',
  'avgUnderwaterDurationDays',
  'pctTimeUnderwater',
  'volatilityPct',
  'historicalVaRPct',
  'ewmaMaxPct',
  'hedgeActivationEvents',
  'hedgeActivationFrequencyPct',
  'pctDaysHedged',
  'averageHedgeRatioPct',
  'returnSacrificedPct',
  'returnEffect',
  'drawdownReductionPctPoints',
  'volatilityReductionPctPoints',
  'varReductionPctPoints',
  'protectionEfficiencyRatio',
  'paretoCandidate'
];

const COMPARISON_COLUMNS = [
  'configId',
  'stressHedgePct',
  'crisisHedgePct',
  'unhedgedTotalReturnPct',
  'v02ProportionalTotalReturnPct',
  'v03OverlayTotalReturnPct',
  'v02MinusUnhedgedReturnPctPoints',
  'v03MinusUnhedgedReturnPctPoints',
  'v03MinusV02ReturnPctPoints',
  'unhedgedMaxDrawdownPct',
  'v02ProportionalMaxDrawdownPct',
  'v03OverlayMaxDrawdownPct',
  'v02DrawdownReductionPctPoints',
  'v03DrawdownReductionPctPoints',
  'v03MinusV02DrawdownReductionPctPoints',
  'unhedgedHistoricalVaRPct',
  'v02ProportionalHistoricalVaRPct',
  'v03OverlayHistoricalVaRPct',
  'v02VarReductionPctPoints',
  'v03VarReductionPctPoints',
  'v03MinusV02VarReductionPctPoints',
  'v02ReturnEffect',
  'v03ReturnEffect',
  'v02ParetoCandidate',
  'v03ParetoCandidate'
];

function signalKey(year, date) {
  return `${year}|${date}`;
}

function configId(stress, crisis) {
  return `stress${Math.round(stress * 100)}_crisis${Math.round(crisis * 100)}`;
}

function loadSignals() {
  return new Map(readCsv(SIGNALS_PATH).map(row => [signalKey(Number(row.year), row.date), row]));
}

function loadDailyRows() {
  return YEARS.flatMap(item => {
    const payload = readJson(item.input);
    return (payload.rows || []).map(row => ({ ...row, year: item.year, regime: item.regime }));
  }).sort((a, b) => `${a.year}-${a.date}-${a.cycle_id}`.localeCompare(`${b.year}-${b.date}-${b.cycle_id}`));
}

function buildBaseRows() {
  const signals = loadSignals();
  const rows = loadDailyRows();
  let lastValidAlertState = null;
  let previousUnderlyingPrice = null;

  return rows.map(row => {
    const signal = signals.get(signalKey(row.year, row.date));
    if (!signal) throw new Error(`Missing v0.4b signal for ${row.year} ${row.date}`);
    const ccwReturnPct = optionalNumber(row.daily_return_pct);
    const underlyingPrice = optionalNumber(row.underlying_price);
    const underlyingReturnPct = ccwReturnPct !== null && previousUnderlyingPrice !== null && underlyingPrice !== null
      ? (underlyingPrice / previousUnderlyingPrice - 1) * 100
      : null;
    const appliedAlertState = ccwReturnPct === null ? null : lastValidAlertState || 'normal';

    if (optionalNumber(row.approximate_CCW_value) !== null) {
      lastValidAlertState = signal.alert_state || 'normal';
      previousUnderlyingPrice = underlyingPrice;
    }

    return {
      date: row.date,
      year: row.year,
      regime: row.regime,
      source_alert_state: signal.alert_state || 'normal',
      applied_alert_state: appliedAlertState,
      ccw_daily_return_pct: ccwReturnPct,
      underlying_price: underlyingPrice,
      underlying_daily_return_pct: underlyingReturnPct
    };
  });
}

function hedgeRatioFor(state, stress, crisis) {
  if (state === 'stress') return stress;
  if (state === 'crisis') return crisis;
  return 0;
}

function simulateOverlay(baseRows, stress, crisis) {
  return baseRows.map(row => {
    const ccwReturnPct = optionalNumber(row.ccw_daily_return_pct);
    const underlyingReturnPct = optionalNumber(row.underlying_daily_return_pct);
    const hedgeRatio = ccwReturnPct === null ? null : hedgeRatioFor(row.applied_alert_state, stress, crisis);
    const hedgedReturnPct = ccwReturnPct === null || underlyingReturnPct === null
      ? null
      : ccwReturnPct - hedgeRatio * underlyingReturnPct;
    return { ...row, hedge_ratio: hedgeRatio, hedged_daily_return_pct: hedgedReturnPct };
  });
}

function seriesStats(rows, returnField) {
  const validRows = rows.filter(row => optionalNumber(row[returnField]) !== null);
  const returns = validRows.map(row => optionalNumber(row[returnField]));
  const startDate = validRows.length ? validRows[0].date : null;
  const endDate = validRows.length ? validRows[validRows.length - 1].date : null;
  const years = startDate && endDate ? yearsBetween(startDate, endDate) : null;
  let equity = 1;
  let peak = 1;
  let ewmaVar = null;
  let currentUnderwater = 0;
  let maxUnderwater = 0;
  let underwaterDays = 0;
  const underwaterDurations = [];
  const drawdowns = [];
  const ewma = [];

  for (const returnPct of returns) {
    const returnDecimal = returnPct / 100;
    equity *= (1 + returnDecimal);
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? (equity / peak - 1) * 100 : null;
    drawdowns.push(drawdownPct);

    ewmaVar = ewmaVar === null
      ? returnDecimal ** 2
      : LAMBDA * ewmaVar + (1 - LAMBDA) * returnDecimal ** 2;
    ewma.push(Math.sqrt(ewmaVar) * 100);

    if (drawdownPct < 0) {
      currentUnderwater += 1;
      underwaterDays += 1;
      maxUnderwater = Math.max(maxUnderwater, currentUnderwater);
    } else {
      if (currentUnderwater > 0) underwaterDurations.push(currentUnderwater);
      currentUnderwater = 0;
    }
  }
  if (currentUnderwater > 0) underwaterDurations.push(currentUnderwater);

  return {
    validReturnDays: returns.length,
    totalReturnPct: (equity - 1) * 100,
    CAGRpct: !years || years <= 0 ? null : ((equity ** (1 / years)) - 1) * 100,
    maxDrawdownPct: drawdowns.length ? Math.min(...drawdowns) : null,
    maxUnderwaterDurationDays: maxUnderwater,
    avgUnderwaterDurationDays: underwaterDurations.length ? mean(underwaterDurations) : 0,
    pctTimeUnderwater: validRows.length ? underwaterDays / validRows.length * 100 : null,
    volatilityPct: sampleStdDev(returns),
    historicalVaRPct: percentile(returns, 0.05),
    ewmaMaxPct: ewma.length ? Math.max(...ewma) : null
  };
}

function hedgeUseStats(rows) {
  const validRows = rows.filter(row => optionalNumber(row.ccw_daily_return_pct) !== null);
  let activationEvents = 0;
  let previousHedged = false;
  let hedgedDays = 0;
  let hedgeRatioSum = 0;

  for (const row of validRows) {
    const ratio = optionalNumber(row.hedge_ratio) ?? 0;
    const hedged = ratio > 0;
    if (hedged && !previousHedged) activationEvents += 1;
    if (hedged) hedgedDays += 1;
    hedgeRatioSum += ratio;
    previousHedged = hedged;
  }

  return {
    hedgeActivationEvents: activationEvents,
    hedgeActivationFrequencyPct: validRows.length ? activationEvents / validRows.length * 100 : null,
    pctDaysHedged: validRows.length ? hedgedDays / validRows.length * 100 : null,
    averageHedgeRatioPct: validRows.length ? hedgeRatioSum / validRows.length * 100 : null
  };
}

function roundStats(stats) {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [
    key,
    typeof value === 'number' ? roundNumber(value) : value
  ]));
}

function summarizeConfig(baseRows, stress, crisis, unhedgedStats) {
  const rows = simulateOverlay(baseRows, stress, crisis);
  const hedgedStats = seriesStats(rows, 'hedged_daily_return_pct');
  const hedgeUse = hedgeUseStats(rows);
  const validCcwDays = baseRows.filter(row => optionalNumber(row.ccw_daily_return_pct) !== null).length;
  const underlyingReturnDays = baseRows.filter(row => optionalNumber(row.ccw_daily_return_pct) !== null && optionalNumber(row.underlying_daily_return_pct) !== null).length;
  const returnSacrificed = unhedgedStats.totalReturnPct - hedgedStats.totalReturnPct;
  const drawdownReduction = Math.abs(unhedgedStats.maxDrawdownPct) - Math.abs(hedgedStats.maxDrawdownPct);
  const volatilityReduction = unhedgedStats.volatilityPct - hedgedStats.volatilityPct;
  const varReduction = Math.abs(unhedgedStats.historicalVaRPct) - Math.abs(hedgedStats.historicalVaRPct);
  return roundStats({
    configId: configId(stress, crisis),
    stressHedgePct: stress * 100,
    crisisHedgePct: crisis * 100,
    ...hedgedStats,
    underlyingReturnDays,
    missingUnderlyingReturnDays: validCcwDays - underlyingReturnDays,
    ...hedgeUse,
    returnSacrificedPct: returnSacrificed,
    returnEffect: returnSacrificed <= 0 ? 'return improved' : 'return sacrificed',
    drawdownReductionPctPoints: drawdownReduction,
    volatilityReductionPctPoints: volatilityReduction,
    varReductionPctPoints: varReduction,
    protectionEfficiencyRatio: returnSacrificed > 0 ? drawdownReduction / returnSacrificed : null
  });
}

function dominates(a, b) {
  const aRisk = Math.abs(a.maxDrawdownPct);
  const bRisk = Math.abs(b.maxDrawdownPct);
  const aVar = Math.abs(a.historicalVaRPct);
  const bVar = Math.abs(b.historicalVaRPct);
  const betterOrEqual = a.totalReturnPct >= b.totalReturnPct
    && aRisk <= bRisk
    && a.volatilityPct <= b.volatilityPct
    && aVar <= bVar;
  const strictlyBetter = a.totalReturnPct > b.totalReturnPct
    || aRisk < bRisk
    || a.volatilityPct < b.volatilityPct
    || aVar < bVar;
  return betterOrEqual && strictlyBetter;
}

function markPareto(rows) {
  for (const row of rows) {
    row.paretoCandidate = !rows.some(other => other.configId !== row.configId && dominates(other, row));
  }
}

function buildGrid(baseRows) {
  const unhedgedStats = seriesStats(baseRows, 'ccw_daily_return_pct');
  const rows = [];
  for (const stress of STRESS_LEVELS) {
    for (const crisis of CRISIS_LEVELS) {
      rows.push(summarizeConfig(baseRows, stress, crisis, unhedgedStats));
    }
  }
  markPareto(rows);
  return { unhedgedStats: roundStats(unhedgedStats), rows };
}

function buildComparison(unhedgedStats, v03Rows) {
  const v02Rows = new Map(readCsv(V02_GRID_PATH).map(row => [row.configId, row]));
  return v03Rows.map(row => {
    const v02 = v02Rows.get(row.configId);
    if (!v02) throw new Error(`Missing v02 row for ${row.configId}`);
    const v02Return = optionalNumber(v02.totalReturnPct);
    const v02Drawdown = optionalNumber(v02.maxDrawdownPct);
    const v02Var = optionalNumber(v02.historicalVaRPct);
    return roundStats({
      configId: row.configId,
      stressHedgePct: row.stressHedgePct,
      crisisHedgePct: row.crisisHedgePct,
      unhedgedTotalReturnPct: unhedgedStats.totalReturnPct,
      v02ProportionalTotalReturnPct: v02Return,
      v03OverlayTotalReturnPct: row.totalReturnPct,
      v02MinusUnhedgedReturnPctPoints: v02Return - unhedgedStats.totalReturnPct,
      v03MinusUnhedgedReturnPctPoints: row.totalReturnPct - unhedgedStats.totalReturnPct,
      v03MinusV02ReturnPctPoints: row.totalReturnPct - v02Return,
      unhedgedMaxDrawdownPct: unhedgedStats.maxDrawdownPct,
      v02ProportionalMaxDrawdownPct: v02Drawdown,
      v03OverlayMaxDrawdownPct: row.maxDrawdownPct,
      v02DrawdownReductionPctPoints: Math.abs(unhedgedStats.maxDrawdownPct) - Math.abs(v02Drawdown),
      v03DrawdownReductionPctPoints: row.drawdownReductionPctPoints,
      v03MinusV02DrawdownReductionPctPoints: row.drawdownReductionPctPoints - (Math.abs(unhedgedStats.maxDrawdownPct) - Math.abs(v02Drawdown)),
      unhedgedHistoricalVaRPct: unhedgedStats.historicalVaRPct,
      v02ProportionalHistoricalVaRPct: v02Var,
      v03OverlayHistoricalVaRPct: row.historicalVaRPct,
      v02VarReductionPctPoints: Math.abs(unhedgedStats.historicalVaRPct) - Math.abs(v02Var),
      v03VarReductionPctPoints: row.varReductionPctPoints,
      v03MinusV02VarReductionPctPoints: row.varReductionPctPoints - (Math.abs(unhedgedStats.historicalVaRPct) - Math.abs(v02Var)),
      v02ReturnEffect: v02.returnEffect,
      v03ReturnEffect: row.returnEffect,
      v02ParetoCandidate: v02.paretoCandidate,
      v03ParetoCandidate: row.paretoCandidate
    });
  });
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildFindings(unhedgedStats, v03Rows, comparisonRows) {
  const v02Reference = comparisonRows.find(row => row.configId === 'stress30_crisis40');
  const v03BestReturn = v03Rows.slice().sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0];
  const v03BestDrawdown = v03Rows.slice().sort((a, b) => b.maxDrawdownPct - a.maxDrawdownPct)[0];
  const v03BestVar = v03Rows.slice().sort((a, b) => b.historicalVaRPct - a.historicalVaRPct)[0];
  const v03Pareto = v03Rows.filter(row => row.paretoCandidate);
  const improvedCount = v03Rows.filter(row => row.returnEffect === 'return improved').length;
  const positiveDdCount = v03Rows.filter(row => row.drawdownReductionPctPoints > 0).length;
  const positiveVarCount = v03Rows.filter(row => row.varReductionPctPoints > 0).length;

  return [
    '# Partial Hedge Simulation v0.3 Underlying Overlay',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Strategy: BTC Weekly OTM05.',
    '- Inputs: existing Daily Approximate MTM and Passive Hedge Monitoring v0.4b artifacts.',
    '- No new Daily MTM and no backtests.',
    '- Classification: research-grade only.',
    '',
    '## Methodology Review',
    '',
    'The v01/v02 formula was:',
    '',
    '```text',
    'hedged_daily_return = ccw_daily_return * (1 - hedge_ratio)',
    '```',
    '',
    'That is a proportional reduction of the CCW return stream. It is useful as a first proxy, but it is not the closest approximation to a short futures/perpetual overlay.',
    '',
    'The v03 formula is:',
    '',
    '```text',
    'hedged_daily_return = ccw_daily_return - hedge_ratio * underlying_daily_return',
    '```',
    '',
    'This is closer to a short BTC-PERPETUAL/futures overlay because the hedge PnL is linked to the underlying BTC return, not to the CCW return itself.',
    '',
    'The Daily MTM artifacts contain `underlying_price`, so `underlying_daily_return` is reconstructed between the same valid daily snapshots used by the CCW daily return. Missing CCW return rows remain excluded.',
    '',
    '## Unhedged Baseline',
    '',
    markdownTable([unhedgedStats], ['validReturnDays', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct']),
    '',
    '## v03 Grid Summary',
    '',
    markdownTable(v03Rows, ['configId', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'averageHedgeRatioPct', 'returnEffect', 'drawdownReductionPctPoints', 'varReductionPctPoints', 'paretoCandidate']),
    '',
    '## v02 vs v03 Comparison',
    '',
    markdownTable(comparisonRows, ['configId', 'v02ProportionalTotalReturnPct', 'v03OverlayTotalReturnPct', 'v03MinusV02ReturnPctPoints', 'v02DrawdownReductionPctPoints', 'v03DrawdownReductionPctPoints', 'v03MinusV02DrawdownReductionPctPoints', 'v02VarReductionPctPoints', 'v03VarReductionPctPoints', 'v03MinusV02VarReductionPctPoints']),
    '',
    '## Main Findings',
    '',
    `- v03 configs with return improvement versus unhedged: ${improvedCount} of ${v03Rows.length}.`,
    `- v03 configs with positive drawdown reduction: ${positiveDdCount} of ${v03Rows.length}.`,
    `- v03 configs with positive VaR reduction: ${positiveVarCount} of ${v03Rows.length}.`,
    `- Best v03 total return: ${v03BestReturn.configId} at ${v03BestReturn.totalReturnPct}%.`,
    `- Best v03 max drawdown: ${v03BestDrawdown.configId} at ${v03BestDrawdown.maxDrawdownPct}%.`,
    `- Best v03 historical VaR: ${v03BestVar.configId} at ${v03BestVar.historicalVaRPct}%.`,
    `- v02 stress30_crisis40 exceeded unhedged by ${v02Reference.v02MinusUnhedgedReturnPctPoints} p.p.; v03 stress30_crisis40 exceeded unhedged by ${v02Reference.v03MinusUnhedgedReturnPctPoints} p.p.`,
    '',
    '## Interpretation',
    '',
    '- v01/v02 should be treated as a simplified proportional-exposure proxy.',
    '- v03 is the better research reference for future hedge economics because it approximates a short underlying/perp overlay.',
    '- If v03 remains materially positive, the signal is less likely to be just an artifact of proportional scaling.',
    '- This still excludes funding, basis, slippage, liquidity, margin, collateral, liquidation, and execution timing.',
    '',
    '## Pareto Candidates',
    '',
    markdownTable(v03Pareto, ['configId', 'totalReturnPct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'returnEffect']),
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  if (process.argv.includes('--force')) return;
  const outputs = [OUTPUT_GRID_CSV, OUTPUT_GRID_JSON, OUTPUT_COMPARISON_CSV, OUTPUT_COMPARISON_JSON, OUTPUT_FINDINGS_MD];
  const existing = outputs.filter(file => fs.existsSync(file));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing v03 outputs: ${existing.map(file => path.relative(REPO_ROOT, file)).join(', ')}`);
  }
}

function main() {
  assertNoOverwrite();
  if (!fs.existsSync(V02_GRID_PATH)) throw new Error(`Missing v02 grid summary: ${V02_GRID_PATH}`);
  const baseRows = buildBaseRows();
  const { unhedgedStats, rows: v03Rows } = buildGrid(baseRows);
  const comparisonRows = buildComparison(unhedgedStats, v03Rows);
  const metadata = {
    generatedAt: new Date().toISOString(),
    classification: 'research-grade only',
    formula: 'hedged_daily_return = ccw_daily_return - hedge_ratio * underlying_daily_return',
    monitoringInput: path.relative(REPO_ROOT, SIGNALS_PATH),
    comparisonInput: path.relative(REPO_ROOT, V02_GRID_PATH),
    grid: { stress: STRESS_LEVELS, crisis: CRISIS_LEVELS },
    unhedgedStats
  };

  fs.mkdirSync(OUTPUT_DIR_V03, { recursive: true });
  fs.writeFileSync(OUTPUT_GRID_CSV, `${objectsToCsv(v03Rows, GRID_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_GRID_JSON, `${JSON.stringify({ metadata, rows: v03Rows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_CSV, `${objectsToCsv(comparisonRows, COMPARISON_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_JSON, `${JSON.stringify({ metadata, rows: comparisonRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildFindings(unhedgedStats, v03Rows, comparisonRows), 'utf8');

  for (const file of [OUTPUT_GRID_CSV, OUTPUT_GRID_JSON, OUTPUT_COMPARISON_CSV, OUTPUT_COMPARISON_JSON, OUTPUT_FINDINGS_MD]) {
    console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building partial hedge simulation v0.3 underlying overlay:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildBaseRows,
  buildGrid,
  simulateOverlay
};
