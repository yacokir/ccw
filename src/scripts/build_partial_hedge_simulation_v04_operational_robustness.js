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
const STATES = ['normal', 'watch', 'stress', 'crisis'];
const RANK = Object.fromEntries(STATES.map((state, index) => [state, index]));

const CONFIGS = [
  { configId: 'stress30_crisis40', stressHedgePct: 30, crisisHedgePct: 40 },
  { configId: 'stress25_crisis50', stressHedgePct: 25, crisisHedgePct: 50 }
];

const SCENARIOS = [
  { scenarioId: 'A_immediate', label: 'Immediate execution', kind: 'immediate' },
  { scenarioId: 'B_delay_1_valid_mtm_day', label: '1 valid MTM day delay', kind: 'delay', delay: 1 },
  { scenarioId: 'C_delay_2_valid_mtm_days', label: '2 valid MTM days delay', kind: 'delay', delay: 2 },
  { scenarioId: 'D_confirmation', label: 'Confirmation rule', kind: 'confirmation' },
  { scenarioId: 'E_gradual_deescalation', label: 'Gradual de-escalation', kind: 'gradual' },
  { scenarioId: 'F_delay_confirmation', label: 'Delay + confirmation', kind: 'delay_confirmation', delay: 1 },
  { scenarioId: 'G_delay_confirmation_gradual_exit', label: 'Delay + confirmation + gradual exit', kind: 'delay_confirmation_gradual', delay: 1 }
];

const YEARS = [
  ['2020', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020', 'btc_weekly_otm05_2020_daily_mtm.json')],
  ['2021', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021', 'btc_weekly_otm05_2021_daily_mtm.json')],
  ['2022', 'Bear market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022', 'btc_weekly_otm05_2022_daily_mtm.json')],
  ['2023', 'Recovery', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023', 'btc_weekly_otm05_2023_daily_mtm.json')],
  ['2024', 'ETF/Bull', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024', 'btc_weekly_otm05_2024_daily_mtm.json')],
  ['2025', 'Mixed', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')]
].map(([year, regime, input]) => ({ year: Number(year), regime, input }));

const SIGNALS_PATH = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv');
const OUTPUT_DIR_V04 = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_simulation_v04_operational_robustness');

const OUTPUT_SCENARIO_CSV = path.join(OUTPUT_DIR_V04, 'scenario_summary.csv');
const OUTPUT_SCENARIO_JSON = path.join(OUTPUT_DIR_V04, 'scenario_summary.json');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_DIR_V04, 'yearly_summary.csv');
const OUTPUT_YEARLY_JSON = path.join(OUTPUT_DIR_V04, 'yearly_summary.json');
const OUTPUT_RANKINGS_CSV = path.join(OUTPUT_DIR_V04, 'rankings.csv');
const OUTPUT_PARETO_CSV = path.join(OUTPUT_DIR_V04, 'pareto_candidates.csv');
const OUTPUT_PARETO_JSON = path.join(OUTPUT_DIR_V04, 'pareto_candidates.json');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR_V04, 'findings.md');

const SUMMARY_COLUMNS = [
  'scenarioId', 'label', 'configId', 'stressHedgePct', 'crisisHedgePct',
  'validReturnDays', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct',
  'maxUnderwaterDurationDays', 'avgUnderwaterDurationDays', 'pctTimeUnderwater',
  'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct',
  'hedgeActivationEvents', 'hedgeActivationFrequencyPct', 'pctDaysHedged',
  'averageHedgeRatioPct', 'averageActivationDurationDays',
  'returnSacrificedPct', 'returnEffect', 'drawdownReductionPctPoints',
  'volatilityReductionPctPoints', 'varReductionPctPoints',
  'protectionEfficiencyRatio', 'paretoCandidate'
];

const YEARLY_COLUMNS = [
  'year', 'regime', 'scenarioId', 'configId', 'validReturnDays',
  'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'maxUnderwaterDurationDays',
  'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct',
  'hedgeActivationEvents', 'pctDaysHedged', 'averageHedgeRatioPct',
  'averageActivationDurationDays', 'returnSacrificedPct', 'returnEffect',
  'drawdownReductionPctPoints', 'volatilityReductionPctPoints', 'varReductionPctPoints',
  'protectionEfficiencyRatio'
];

const RANKING_COLUMNS = [
  'ranking', 'rank', 'scenarioId', 'configId', 'metricValue',
  'totalReturnPct', 'maxDrawdownPct', 'historicalVaRPct', 'volatilityPct',
  'pctDaysHedged', 'averageHedgeRatioPct', 'returnEffect', 'paretoCandidate'
];

function signalKey(year, date) {
  return `${year}|${date}`;
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
  const alertHistory = [];
  let previousUnderlyingPrice = null;

  return loadDailyRows().map(row => {
    const signal = signals.get(signalKey(row.year, row.date));
    if (!signal) throw new Error(`Missing v0.4b signal for ${row.year} ${row.date}`);
    const ccwReturnPct = optionalNumber(row.daily_return_pct);
    const underlyingPrice = optionalNumber(row.underlying_price);
    const underlyingReturnPct = ccwReturnPct !== null && previousUnderlyingPrice !== null && underlyingPrice !== null
      ? (underlyingPrice / previousUnderlyingPrice - 1) * 100
      : null;
    const output = {
      date: row.date,
      year: row.year,
      regime: row.regime,
      source_alert_state: signal.alert_state || 'normal',
      ccw_daily_return_pct: ccwReturnPct,
      underlying_daily_return_pct: underlyingReturnPct,
      prior_alert_history: alertHistory.slice()
    };

    if (optionalNumber(row.approximate_CCW_value) !== null) {
      alertHistory.push(signal.alert_state || 'normal');
      previousUnderlyingPrice = underlyingPrice;
    }
    return output;
  });
}

function delayedState(history, delay) {
  const index = history.length - 1 - delay;
  return index >= 0 ? history[index] : 'normal';
}

function confirmedState(rawState, priorState) {
  return RANK[rawState] >= RANK.stress && RANK[priorState] >= RANK.stress ? rawState : 'normal';
}

function stepDown(state) {
  if (state === 'crisis') return 'stress';
  if (state === 'stress') return 'watch';
  if (state === 'watch') return 'normal';
  return 'normal';
}

function scenarioStates(baseRows, scenario) {
  let gradualState = 'normal';
  return baseRows.map(row => {
    if (optionalNumber(row.ccw_daily_return_pct) === null) return null;
    const history = row.prior_alert_history;
    const immediate = delayedState(history, 0);
    const delayed = delayedState(history, scenario.delay || 0);
    const delayedPrior = delayedState(history, (scenario.delay || 0) + 1);
    let target = 'normal';

    if (scenario.kind === 'immediate') target = immediate;
    else if (scenario.kind === 'delay') target = delayed;
    else if (scenario.kind === 'confirmation') target = confirmedState(immediate, delayedState(history, 1));
    else if (scenario.kind === 'gradual') target = immediate;
    else if (scenario.kind === 'delay_confirmation') target = confirmedState(delayed, delayedPrior);
    else if (scenario.kind === 'delay_confirmation_gradual') target = confirmedState(delayed, delayedPrior);

    if (scenario.kind === 'gradual' || scenario.kind === 'delay_confirmation_gradual') {
      if (RANK[target] >= RANK[gradualState]) gradualState = target;
      else gradualState = stepDown(gradualState);
      return gradualState;
    }

    return target;
  });
}

function hedgeRatioFor(state, config) {
  if (state === 'stress') return config.stressHedgePct / 100;
  if (state === 'crisis') return config.crisisHedgePct / 100;
  return 0;
}

function simulate(baseRows, scenario, config) {
  const states = scenarioStates(baseRows, scenario);
  return baseRows.map((row, index) => {
    const ccw = optionalNumber(row.ccw_daily_return_pct);
    if (ccw === null) return { ...row, applied_alert_state: null, hedge_ratio: null, hedged_daily_return_pct: null };
    const state = states[index];
    const hedgeRatio = hedgeRatioFor(state, config);
    const underlying = optionalNumber(row.underlying_daily_return_pct);
    return {
      ...row,
      applied_alert_state: state,
      hedge_ratio: hedgeRatio,
      hedged_daily_return_pct: underlying === null ? null : ccw - hedgeRatio * underlying
    };
  });
}

function seriesStats(rows, field) {
  const validRows = rows.filter(row => optionalNumber(row[field]) !== null);
  const returns = validRows.map(row => optionalNumber(row[field]));
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
    const ret = returnPct / 100;
    equity *= (1 + ret);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? (equity / peak - 1) * 100 : null;
    drawdowns.push(dd);
    ewmaVar = ewmaVar === null ? ret ** 2 : LAMBDA * ewmaVar + (1 - LAMBDA) * ret ** 2;
    ewma.push(Math.sqrt(ewmaVar) * 100);
    if (dd < 0) {
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
  let previousHedged = false;
  let activations = 0;
  let currentDuration = 0;
  const durations = [];
  let hedgedDays = 0;
  let ratioSum = 0;

  for (const row of validRows) {
    const ratio = optionalNumber(row.hedge_ratio) ?? 0;
    const hedged = ratio > 0;
    ratioSum += ratio;
    if (hedged) {
      hedgedDays += 1;
      currentDuration += 1;
      if (!previousHedged) activations += 1;
    } else if (previousHedged) {
      durations.push(currentDuration);
      currentDuration = 0;
    }
    previousHedged = hedged;
  }
  if (currentDuration > 0) durations.push(currentDuration);

  return {
    hedgeActivationEvents: activations,
    hedgeActivationFrequencyPct: validRows.length ? activations / validRows.length * 100 : null,
    pctDaysHedged: validRows.length ? hedgedDays / validRows.length * 100 : null,
    averageHedgeRatioPct: validRows.length ? ratioSum / validRows.length * 100 : null,
    averageActivationDurationDays: durations.length ? mean(durations) : 0
  };
}

function roundStats(stats) {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [
    key,
    typeof value === 'number' ? roundNumber(value) : value
  ]));
}

function summarize(rows, baseline, scenario, config) {
  const stats = seriesStats(rows, 'hedged_daily_return_pct');
  const use = hedgeUseStats(rows);
  const returnSacrificed = baseline.totalReturnPct - stats.totalReturnPct;
  const ddReduction = Math.abs(baseline.maxDrawdownPct) - Math.abs(stats.maxDrawdownPct);
  const volReduction = baseline.volatilityPct - stats.volatilityPct;
  const varReduction = Math.abs(baseline.historicalVaRPct) - Math.abs(stats.historicalVaRPct);
  return roundStats({
    scenarioId: scenario.scenarioId,
    label: scenario.label,
    configId: config.configId,
    stressHedgePct: config.stressHedgePct,
    crisisHedgePct: config.crisisHedgePct,
    ...stats,
    ...use,
    returnSacrificedPct: returnSacrificed,
    returnEffect: returnSacrificed <= 0 ? 'return improved' : 'return sacrificed',
    drawdownReductionPctPoints: ddReduction,
    volatilityReductionPctPoints: volReduction,
    varReductionPctPoints: varReduction,
    protectionEfficiencyRatio: returnSacrificed > 0 ? ddReduction / returnSacrificed : null
  });
}

function buildSummaries(baseRows) {
  const baseline = seriesStats(baseRows, 'ccw_daily_return_pct');
  const scenarioRows = [];
  const yearlyRows = [];
  for (const config of CONFIGS) {
    for (const scenario of SCENARIOS) {
      const simulated = simulate(baseRows, scenario, config);
      scenarioRows.push(summarize(simulated, baseline, scenario, config));
      for (const year of YEARS) {
        const yearBase = baseRows.filter(row => row.year === year.year);
        const yearSim = simulate(yearBase, scenario, config);
        const yearBaseline = seriesStats(yearBase, 'ccw_daily_return_pct');
        yearlyRows.push({
          year: year.year,
          regime: year.regime,
          ...summarize(yearSim, yearBaseline, scenario, config)
        });
      }
    }
  }
  markPareto(scenarioRows);
  return { baseline: roundStats(baseline), scenarioRows, yearlyRows };
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
    row.paretoCandidate = !rows.some(other => other !== row && dominates(other, row));
  }
}

function topRows(rows, ranking, metric, direction, limit = 5) {
  return rows.slice().sort((a, b) => {
    const av = optionalNumber(a[metric]);
    const bv = optionalNumber(b[metric]);
    return direction === 'asc' ? av - bv : bv - av;
  }).slice(0, limit).map((row, index) => ({
    ranking,
    rank: index + 1,
    scenarioId: row.scenarioId,
    configId: row.configId,
    metricValue: row[metric],
    totalReturnPct: row.totalReturnPct,
    maxDrawdownPct: row.maxDrawdownPct,
    historicalVaRPct: row.historicalVaRPct,
    volatilityPct: row.volatilityPct,
    pctDaysHedged: row.pctDaysHedged,
    averageHedgeRatioPct: row.averageHedgeRatioPct,
    returnEffect: row.returnEffect,
    paretoCandidate: row.paretoCandidate
  }));
}

function buildRankings(rows) {
  const efficiencyRows = rows.filter(row => optionalNumber(row.protectionEfficiencyRatio) !== null);
  return [
    ...topRows(rows, 'best_total_return', 'totalReturnPct', 'desc'),
    ...topRows(rows, 'best_max_drawdown', 'maxDrawdownPct', 'desc'),
    ...topRows(rows, 'best_historical_var', 'historicalVaRPct', 'desc'),
    ...topRows(efficiencyRows, 'best_protection_efficiency', 'protectionEfficiencyRatio', 'desc'),
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

function buildFindings(baseline, scenarioRows, yearlyRows, rankings, paretoRows) {
  const primary = scenarioRows.filter(row => row.configId === 'stress30_crisis40');
  const benchmark = scenarioRows.filter(row => row.configId === 'stress25_crisis50');
  const bestReturn = rankings.find(row => row.ranking === 'best_total_return' && row.rank === 1);
  const bestDd = rankings.find(row => row.ranking === 'best_max_drawdown' && row.rank === 1);
  const bestVar = rankings.find(row => row.ranking === 'best_historical_var' && row.rank === 1);
  const robustPrimary = primary.filter(row => row.returnEffect === 'return improved' && row.drawdownReductionPctPoints > 0 && row.varReductionPctPoints > 0);
  const robustBenchmark = benchmark.filter(row => row.returnEffect === 'return improved' && row.drawdownReductionPctPoints > 0 && row.varReductionPctPoints > 0);

  return [
    '# Partial Hedge Simulation v0.4 Operational Robustness',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Strategy: BTC Weekly OTM05.',
    '- Inputs: existing Daily Approximate MTM, Passive Hedge Monitoring v0.4b, and v03 underlying-overlay methodology.',
    '- No new Daily MTM and no backtests.',
    '- Classification: research-grade only.',
    '',
    '## Formula',
    '',
    '```text',
    'hedged_daily_return = ccw_daily_return - hedge_ratio * underlying_daily_return',
    '```',
    '',
    'Still excluded: funding, basis, slippage, margin, liquidity, collateral, specific hedge instrument, liquidation, and execution constraints.',
    '',
    '## Unhedged Baseline',
    '',
    markdownTable([baseline], ['validReturnDays', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct']),
    '',
    '## Scenario Summary',
    '',
    markdownTable(scenarioRows, ['scenarioId', 'configId', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'averageActivationDurationDays', 'returnEffect', 'drawdownReductionPctPoints', 'varReductionPctPoints', 'paretoCandidate']),
    '',
    '## Rankings',
    '',
    markdownTable(rankings, ['ranking', 'rank', 'scenarioId', 'configId', 'metricValue', 'totalReturnPct', 'maxDrawdownPct', 'historicalVaRPct', 'returnEffect', 'paretoCandidate']),
    '',
    '## Pareto Candidates',
    '',
    markdownTable(paretoRows, ['scenarioId', 'configId', 'totalReturnPct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'returnEffect']),
    '',
    '## Main Findings',
    '',
    `- Best total return: ${bestReturn.scenarioId} / ${bestReturn.configId} at ${bestReturn.totalReturnPct}%.`,
    `- Best max drawdown: ${bestDd.scenarioId} / ${bestDd.configId} at ${bestDd.maxDrawdownPct}%.`,
    `- Best historical VaR: ${bestVar.scenarioId} / ${bestVar.configId} at ${bestVar.historicalVaRPct}%.`,
    `- stress30_crisis40 robust scenarios: ${robustPrimary.length} of ${primary.length}.`,
    `- stress25_crisis50 robust scenarios: ${robustBenchmark.length} of ${benchmark.length}.`,
    `- Pareto candidate count: ${paretoRows.length}.`,
    '',
    '## Interpretation',
    '',
    '- If delayed or confirmation-based scenarios remain above unhedged with lower drawdown and VaR, the signal is less dependent on near-perfect timing.',
    '- Gradual de-escalation is useful if it improves stability without excessive hedge persistence.',
    '- Scenarios that require much more hedge exposure for weaker return, drawdown, and VaR are dominated for this research stage.',
    '',
    '## Yearly Summary',
    '',
    markdownTable(yearlyRows.filter(row => row.configId === 'stress30_crisis40'), ['year', 'regime', 'scenarioId', 'totalReturnPct', 'maxDrawdownPct', 'historicalVaRPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'returnEffect']),
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  if (process.argv.includes('--force')) return;
  const outputs = [OUTPUT_SCENARIO_CSV, OUTPUT_SCENARIO_JSON, OUTPUT_YEARLY_CSV, OUTPUT_YEARLY_JSON, OUTPUT_RANKINGS_CSV, OUTPUT_PARETO_CSV, OUTPUT_PARETO_JSON, OUTPUT_FINDINGS_MD];
  const existing = outputs.filter(file => fs.existsSync(file));
  if (existing.length) throw new Error(`Refusing to overwrite v04 outputs: ${existing.map(file => path.relative(REPO_ROOT, file)).join(', ')}`);
}

function main() {
  assertNoOverwrite();
  const baseRows = buildBaseRows();
  const { baseline, scenarioRows, yearlyRows } = buildSummaries(baseRows);
  const rankings = buildRankings(scenarioRows);
  const paretoRows = scenarioRows.filter(row => row.paretoCandidate);
  const metadata = {
    generatedAt: new Date().toISOString(),
    classification: 'research-grade only',
    formula: 'hedged_daily_return = ccw_daily_return - hedge_ratio * underlying_daily_return',
    configs: CONFIGS,
    scenarios: SCENARIOS,
    baseline
  };

  fs.mkdirSync(OUTPUT_DIR_V04, { recursive: true });
  fs.writeFileSync(OUTPUT_SCENARIO_CSV, `${objectsToCsv(scenarioRows, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SCENARIO_JSON, `${JSON.stringify({ metadata, rows: scenarioRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(yearlyRows, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_JSON, `${JSON.stringify({ metadata, rows: yearlyRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_RANKINGS_CSV, `${objectsToCsv(rankings, RANKING_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_PARETO_CSV, `${objectsToCsv(paretoRows, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_PARETO_JSON, `${JSON.stringify({ metadata, rows: paretoRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildFindings(baseline, scenarioRows, yearlyRows, rankings, paretoRows), 'utf8');

  for (const file of [OUTPUT_SCENARIO_CSV, OUTPUT_SCENARIO_JSON, OUTPUT_YEARLY_CSV, OUTPUT_YEARLY_JSON, OUTPUT_RANKINGS_CSV, OUTPUT_PARETO_CSV, OUTPUT_PARETO_JSON, OUTPUT_FINDINGS_MD]) {
    console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building partial hedge simulation v0.4 operational robustness:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildBaseRows,
  buildSummaries,
  simulate
};
