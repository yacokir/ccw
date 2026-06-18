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
].map(([year, regime, input]) => ({ year: Number(year), regime, input: path.normalize(input) }));

const SIGNALS_PATH = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv');
const OUTPUT_GRID_DIR = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_simulation_v02_grid');

const OUTPUT_GRID_CSV = path.join(OUTPUT_GRID_DIR, 'grid_summary.csv');
const OUTPUT_GRID_JSON = path.join(OUTPUT_GRID_DIR, 'grid_summary.json');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_GRID_DIR, 'yearly_grid_summary.csv');
const OUTPUT_YEARLY_JSON = path.join(OUTPUT_GRID_DIR, 'yearly_grid_summary.json');
const OUTPUT_PARETO_CSV = path.join(OUTPUT_GRID_DIR, 'pareto_candidates.csv');
const OUTPUT_PARETO_JSON = path.join(OUTPUT_GRID_DIR, 'pareto_candidates.json');
const OUTPUT_RANKINGS_CSV = path.join(OUTPUT_GRID_DIR, 'rankings.csv');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_GRID_DIR, 'findings.md');

const SUMMARY_COLUMNS = [
  'configId',
  'stressHedgePct',
  'crisisHedgePct',
  'validReturnDays',
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
  'volatilityEfficiencyRatio',
  'varEfficiencyRatio',
  'paretoCandidate'
];

const YEARLY_COLUMNS = [
  'configId',
  'year',
  'regime',
  'stressHedgePct',
  'crisisHedgePct',
  'validReturnDays',
  'totalReturnPct',
  'CAGRpct',
  'maxDrawdownPct',
  'maxUnderwaterDurationDays',
  'volatilityPct',
  'historicalVaRPct',
  'ewmaMaxPct',
  'hedgeActivationEvents',
  'pctDaysHedged',
  'averageHedgeRatioPct',
  'returnSacrificedPct',
  'returnEffect',
  'drawdownReductionPctPoints',
  'volatilityReductionPctPoints',
  'varReductionPctPoints',
  'protectionEfficiencyRatio'
];

const RANKING_COLUMNS = [
  'ranking',
  'rank',
  'configId',
  'stressHedgePct',
  'crisisHedgePct',
  'metricValue',
  'totalReturnPct',
  'maxDrawdownPct',
  'historicalVaRPct',
  'volatilityPct',
  'returnSacrificedPct',
  'returnEffect',
  'paretoCandidate'
];

function signalKey(year, date) {
  return `${year}|${date}`;
}

function configId(stress, crisis) {
  return `stress${Math.round(stress * 100)}_crisis${Math.round(crisis * 100)}`;
}

function loadSignals() {
  if (!fs.existsSync(SIGNALS_PATH)) throw new Error(`Missing v0.4b signals: ${SIGNALS_PATH}`);
  return new Map(readCsv(SIGNALS_PATH).map(row => [signalKey(Number(row.year), row.date), row]));
}

function loadDailyRows() {
  return YEARS.flatMap(item => {
    if (!fs.existsSync(item.input)) throw new Error(`Missing Daily MTM input: ${item.input}`);
    const payload = readJson(item.input);
    return (payload.rows || []).map(row => ({ ...row, year: item.year, regime: item.regime }));
  }).sort((a, b) => `${a.year}-${a.date}-${a.cycle_id}`.localeCompare(`${b.year}-${b.date}-${b.cycle_id}`));
}

function buildBaseRows() {
  const signals = loadSignals();
  let lastValidAlertState = null;

  return loadDailyRows().map(row => {
    const signal = signals.get(signalKey(row.year, row.date));
    if (!signal) throw new Error(`Missing v0.4b signal for ${row.year} ${row.date}`);
    const unhedgedDailyReturnPct = optionalNumber(row.daily_return_pct);
    const appliedAlertState = unhedgedDailyReturnPct === null ? null : lastValidAlertState || 'normal';
    if (optionalNumber(row.approximate_CCW_value) !== null) lastValidAlertState = signal.alert_state || 'normal';
    return {
      date: row.date,
      year: row.year,
      regime: row.regime,
      source_alert_state: signal.alert_state || 'normal',
      applied_alert_state: appliedAlertState,
      unhedged_daily_return_pct: unhedgedDailyReturnPct
    };
  });
}

function hedgeRatioFor(state, stress, crisis) {
  if (state === 'stress') return stress;
  if (state === 'crisis') return crisis;
  return 0;
}

function simulateReturns(baseRows, stress, crisis) {
  return baseRows.map(row => {
    const unhedged = optionalNumber(row.unhedged_daily_return_pct);
    const hedgeRatio = unhedged === null ? null : hedgeRatioFor(row.applied_alert_state, stress, crisis);
    return {
      ...row,
      hedge_ratio: hedgeRatio,
      hedged_daily_return_pct: unhedged === null ? null : unhedged * (1 - hedgeRatio)
    };
  });
}

function seriesStats(rows, returnField) {
  const validRows = rows.filter(row => optionalNumber(row[returnField]) !== null);
  const returns = validRows.map(row => optionalNumber(row[returnField]));
  const startDate = validRows.length ? validRows[0].date : null;
  const endDate = validRows.length ? validRows[validRows.length - 1].date : null;
  const years = startDate && endDate ? yearsBetween(startDate, endDate) : null;
  const ewma = [];
  const drawdowns = [];
  let equity = 1;
  let peak = 1;
  let ewmaVar = null;
  let currentUnderwater = 0;
  let maxUnderwater = 0;
  let underwaterDays = 0;
  const underwaterDurations = [];

  for (const returnPct of returns) {
    const returnDecimal = returnPct / 100;
    ewmaVar = ewmaVar === null
      ? returnDecimal ** 2
      : LAMBDA * ewmaVar + (1 - LAMBDA) * returnDecimal ** 2;
    ewma.push(Math.sqrt(ewmaVar) * 100);
    equity *= (1 + returnDecimal);
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? (equity / peak - 1) * 100 : null;
    drawdowns.push(drawdownPct);
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
  const validRows = rows.filter(row => optionalNumber(row.unhedged_daily_return_pct) !== null);
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

function summarizeConfig(baseRows, stress, crisis, baselineStats, scopeRows = null) {
  const rows = simulateReturns(scopeRows || baseRows, stress, crisis);
  const hedged = seriesStats(rows, 'hedged_daily_return_pct');
  const hedgeUse = hedgeUseStats(rows);
  const returnSacrificed = baselineStats.totalReturnPct - hedged.totalReturnPct;
  const drawdownReduction = Math.abs(baselineStats.maxDrawdownPct) - Math.abs(hedged.maxDrawdownPct);
  const volatilityReduction = baselineStats.volatilityPct - hedged.volatilityPct;
  const varReduction = Math.abs(baselineStats.historicalVaRPct) - Math.abs(hedged.historicalVaRPct);

  return roundStats({
    configId: configId(stress, crisis),
    stressHedgePct: stress * 100,
    crisisHedgePct: crisis * 100,
    ...hedged,
    ...hedgeUse,
    returnSacrificedPct: returnSacrificed,
    returnEffect: returnSacrificed <= 0 ? 'return improved' : 'return sacrificed',
    drawdownReductionPctPoints: drawdownReduction,
    volatilityReductionPctPoints: volatilityReduction,
    varReductionPctPoints: varReduction,
    protectionEfficiencyRatio: returnSacrificed > 0 ? drawdownReduction / returnSacrificed : null,
    volatilityEfficiencyRatio: returnSacrificed > 0 ? volatilityReduction / returnSacrificed : null,
    varEfficiencyRatio: returnSacrificed > 0 ? varReduction / returnSacrificed : null
  });
}

function roundStats(stats) {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [
    key,
    typeof value === 'number' ? roundNumber(value) : value
  ]));
}

function buildGrid(baseRows) {
  const baselineStats = seriesStats(baseRows, 'unhedged_daily_return_pct');
  const rows = [];
  for (const stress of STRESS_LEVELS) {
    for (const crisis of CRISIS_LEVELS) {
      rows.push(summarizeConfig(baseRows, stress, crisis, baselineStats));
    }
  }
  markPareto(rows);
  return { baselineStats: roundStats(baselineStats), rows };
}

function buildYearlyGrid(baseRows) {
  const rows = [];
  for (const yearInfo of YEARS) {
    const yearRows = baseRows.filter(row => row.year === yearInfo.year);
    const baselineStats = seriesStats(yearRows, 'unhedged_daily_return_pct');
    for (const stress of STRESS_LEVELS) {
      for (const crisis of CRISIS_LEVELS) {
        rows.push({
          ...summarizeConfig(baseRows, stress, crisis, baselineStats, yearRows),
          year: yearInfo.year,
          regime: yearInfo.regime
        });
      }
    }
  }
  return rows;
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

function topRows(rows, ranking, metric, direction, limit = 5) {
  const sorted = rows.slice().sort((a, b) => {
    const av = optionalNumber(a[metric]);
    const bv = optionalNumber(b[metric]);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return direction === 'asc' ? av - bv : bv - av;
  });
  return sorted.slice(0, limit).map((row, index) => ({
    ranking,
    rank: index + 1,
    configId: row.configId,
    stressHedgePct: row.stressHedgePct,
    crisisHedgePct: row.crisisHedgePct,
    metricValue: row[metric],
    totalReturnPct: row.totalReturnPct,
    maxDrawdownPct: row.maxDrawdownPct,
    historicalVaRPct: row.historicalVaRPct,
    volatilityPct: row.volatilityPct,
    returnSacrificedPct: row.returnSacrificedPct,
    returnEffect: row.returnEffect,
    paretoCandidate: row.paretoCandidate
  }));
}

function buildRankings(rows) {
  const positiveEfficiency = rows.filter(row => optionalNumber(row.protectionEfficiencyRatio) !== null);
  return [
    ...topRows(rows, 'best_total_return', 'totalReturnPct', 'desc'),
    ...topRows(rows, 'best_max_drawdown', 'maxDrawdownPct', 'desc'),
    ...topRows(rows, 'best_historical_var', 'historicalVaRPct', 'desc'),
    ...topRows(positiveEfficiency, 'best_protection_efficiency', 'protectionEfficiencyRatio', 'desc'),
    ...topRows(rows.filter(row => row.paretoCandidate), 'pareto_candidates', 'totalReturnPct', 'desc', rows.length)
  ];
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildFindings(baseline, gridRows, yearlyRows, paretoRows, rankings) {
  const v01 = gridRows.find(row => row.configId === 'stress25_crisis50');
  const bestReturn = rankings.find(row => row.ranking === 'best_total_return' && row.rank === 1);
  const bestDrawdown = rankings.find(row => row.ranking === 'best_max_drawdown' && row.rank === 1);
  const bestVar = rankings.find(row => row.ranking === 'best_historical_var' && row.rank === 1);
  const allReturnImproved = gridRows.every(row => row.returnEffect === 'return improved');
  const monotonicReturn = STRESS_LEVELS.every(stress => {
    const slice = gridRows.filter(row => row.stressHedgePct === stress * 100).sort((a, b) => a.crisisHedgePct - b.crisisHedgePct);
    return slice.every((row, index) => index === 0 || row.totalReturnPct >= slice[index - 1].totalReturnPct);
  });
  const yearlyBestRows = YEARS.map(year => {
    const rows = yearlyRows.filter(row => row.year === year.year);
    return rows.slice().sort((a, b) => b.totalReturnPct - a.totalReturnPct)[0];
  });

  return [
    '# Partial Hedge Simulation v0.2 Grid',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Strategy: BTC Weekly OTM05.',
    '- Period: Daily Approximate MTM multi-year artifacts, 2020-2025.',
    '- Monitoring input: Passive Hedge Monitoring v0.4b recommended signals.',
    '- Classification: research-grade only.',
    '- No new Daily MTM, no backtests, no funding, no basis, no slippage, no margin, no liquidity, and no collateral modeling.',
    '',
    '## Methodology',
    '',
    'The simulation preserves the v0.1 timing convention: the `alert_state` from the previous valid Daily MTM observation is applied to the next valid daily return.',
    '',
    'Formula:',
    '',
    '```text',
    'hedged_daily_return = unhedged_daily_return * (1 - hedge_ratio)',
    '```',
    '',
    'When `return_sacrificed <= 0`, the result is marked as `return improved` and protection efficiency is not forced into an artificial ratio.',
    '',
    '## Baseline Unhedged',
    '',
    markdownTable([baseline], ['validReturnDays', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct']),
    '',
    '## Grid Summary',
    '',
    markdownTable(gridRows, ['configId', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'returnSacrificedPct', 'returnEffect', 'drawdownReductionPctPoints', 'varReductionPctPoints', 'paretoCandidate']),
    '',
    '## Rankings',
    '',
    markdownTable(rankings, ['ranking', 'rank', 'configId', 'metricValue', 'totalReturnPct', 'maxDrawdownPct', 'historicalVaRPct', 'volatilityPct', 'returnEffect', 'paretoCandidate']),
    '',
    '## Pareto Candidates',
    '',
    markdownTable(paretoRows, ['configId', 'totalReturnPct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'returnEffect']),
    '',
    '## Main Findings',
    '',
    `- v0.1 reference configuration stress25_crisis50 returned ${v01.totalReturnPct}% with max drawdown ${v01.maxDrawdownPct}% and VaR ${v01.historicalVaRPct}%.`,
    `- Best total return: ${bestReturn.configId} at ${bestReturn.totalReturnPct}%.`,
    `- Best max drawdown: ${bestDrawdown.configId} at ${bestDrawdown.maxDrawdownPct}%.`,
    `- Best historical VaR: ${bestVar.configId} at ${bestVar.historicalVaRPct}%.`,
    `- All grid configurations marked return improved: ${allReturnImproved}.`,
    `- Crisis intensity monotonicity by stress slice: ${monotonicReturn}.`,
    `- Pareto candidate count: ${paretoRows.length}.`,
    '',
    '## Yearly Best Return Configurations',
    '',
    markdownTable(yearlyBestRows, ['year', 'regime', 'configId', 'totalReturnPct', 'maxDrawdownPct', 'historicalVaRPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'returnEffect']),
    '',
    '## Interpretation',
    '',
    '- The preliminary economic value does not appear to depend only on the v0.1 stress25/crisis50 setting.',
    '- Higher stress intensity generally increases protection in the stressed years but can modestly reduce return in calmer years.',
    '- Because this model uses proportional exposure reduction, results should be interpreted as a robustness screen rather than hedge economics.',
    '- The next step should test realistic hedge PnL with funding, basis, slippage, margin, liquidity, and collateral assumptions before any operational conclusion.',
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  if (process.argv.includes('--force')) return;
  const outputs = [
    OUTPUT_GRID_CSV,
    OUTPUT_GRID_JSON,
    OUTPUT_YEARLY_CSV,
    OUTPUT_YEARLY_JSON,
    OUTPUT_PARETO_CSV,
    OUTPUT_PARETO_JSON,
    OUTPUT_RANKINGS_CSV,
    OUTPUT_FINDINGS_MD
  ];
  const existing = outputs.filter(file => fs.existsSync(file));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing v0.2 grid outputs: ${existing.map(file => path.relative(REPO_ROOT, file)).join(', ')}`);
  }
}

function main() {
  assertNoOverwrite();
  const baseRows = buildBaseRows();
  const { baselineStats, rows: gridRows } = buildGrid(baseRows);
  const yearlyRows = buildYearlyGrid(baseRows);
  const paretoRows = gridRows.filter(row => row.paretoCandidate);
  const rankings = buildRankings(gridRows);
  const metadata = {
    generatedAt: new Date().toISOString(),
    classification: 'research-grade only',
    strategy: { asset: 'BTC', tenor: 'weekly', moneyness: 'OTM05', period: '2020-2025' },
    monitoringInput: path.relative(REPO_ROOT, SIGNALS_PATH),
    methodology: {
      formula: 'hedged_daily_return = unhedged_daily_return * (1 - hedge_ratio)',
      timing: 'previous valid Daily MTM alert_state is applied to the next valid daily return',
      excluded: ['specific hedge instrument', 'funding', 'basis', 'slippage', 'margin', 'liquidity', 'collateral']
    },
    grid: {
      stress: STRESS_LEVELS,
      crisis: CRISIS_LEVELS
    },
    baselineStats
  };

  fs.mkdirSync(OUTPUT_GRID_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_GRID_CSV, `${objectsToCsv(gridRows, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_GRID_JSON, `${JSON.stringify({ metadata, rows: gridRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(yearlyRows, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_JSON, `${JSON.stringify({ metadata, rows: yearlyRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_PARETO_CSV, `${objectsToCsv(paretoRows, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_PARETO_JSON, `${JSON.stringify({ metadata, rows: paretoRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_RANKINGS_CSV, `${objectsToCsv(rankings, RANKING_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildFindings(baselineStats, gridRows, yearlyRows, paretoRows, rankings), 'utf8');

  for (const file of [OUTPUT_GRID_CSV, OUTPUT_GRID_JSON, OUTPUT_YEARLY_CSV, OUTPUT_YEARLY_JSON, OUTPUT_PARETO_CSV, OUTPUT_PARETO_JSON, OUTPUT_RANKINGS_CSV, OUTPUT_FINDINGS_MD]) {
    console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building partial hedge simulation v0.2 grid:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildBaseRows,
  buildGrid,
  buildYearlyGrid,
  simulateReturns
};
