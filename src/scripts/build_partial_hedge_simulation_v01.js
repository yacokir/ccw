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

const POLICY = {
  normal: 0,
  watch: 0,
  stress: 0.25,
  crisis: 0.50
};

const YEARS = [
  ['2020', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020', 'btc_weekly_otm05_2020_daily_mtm.json')],
  ['2021', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021', 'btc_weekly_otm05_2021_daily_mtm.json')],
  ['2022', 'Bear market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022', 'btc_weekly_otm05_2022_daily_mtm.json')],
  ['2023', 'Recovery', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023', 'btc_weekly_otm05_2023_daily_mtm.json')],
  ['2024', 'ETF/Bull', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024', 'btc_weekly_otm05_2024_daily_mtm.json')],
  ['2025', 'Mixed', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')]
].map(([year, regime, input]) => ({ year: Number(year), regime, input }));

const SIGNALS_PATH = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration_v04', 'signals_v04_recommended.csv');
const OUTPUT_SIM_DIR = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_simulation_v01');

const OUTPUT_DAILY_CSV = path.join(OUTPUT_SIM_DIR, 'hedged_daily_series.csv');
const OUTPUT_DAILY_JSON = path.join(OUTPUT_SIM_DIR, 'hedged_daily_series.json');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_SIM_DIR, 'yearly_summary.csv');
const OUTPUT_YEARLY_JSON = path.join(OUTPUT_SIM_DIR, 'yearly_summary.json');
const OUTPUT_COMPARISON_CSV = path.join(OUTPUT_SIM_DIR, 'comparison_summary.csv');
const OUTPUT_COMPARISON_JSON = path.join(OUTPUT_SIM_DIR, 'comparison_summary.json');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_SIM_DIR, 'findings.md');

const DAILY_COLUMNS = [
  'date',
  'year',
  'regime',
  'source_alert_state',
  'applied_alert_state',
  'hedge_ratio',
  'unhedged_daily_return_pct',
  'hedged_daily_return_pct',
  'unhedged_equity',
  'hedged_equity',
  'unhedged_drawdown_pct',
  'hedged_drawdown_pct',
  'unhedged_ewma_vol_pct',
  'hedged_ewma_vol_pct',
  'unhedged_historical_var_pct',
  'hedged_historical_var_pct',
  'methodology_note'
];

const COMPARISON_COLUMNS = [
  'scope',
  'series',
  'startDate',
  'endDate',
  'validReturnDays',
  'totalReturnPct',
  'CAGRpct',
  'maxDrawdownPct',
  'maxUnderwaterDurationDays',
  'avgUnderwaterDurationDays',
  'pctTimeUnderwater',
  'volatilityPct',
  'historicalVaRPct',
  'ewmaMeanPct',
  'ewmaMaxPct',
  'ewmaP95Pct',
  'hedgeActivationEvents',
  'hedgeActivationFrequencyPct',
  'pctDaysHedged',
  'averageHedgeRatioPct',
  'returnSacrificedPct',
  'drawdownReductionPctPoints',
  'volatilityReductionPctPoints',
  'varReductionPctPoints',
  'protectionEfficiencyRatio',
  'volatilityEfficiencyRatio',
  'varEfficiencyRatio'
];

const YEARLY_COLUMNS = [
  'year',
  'regime',
  'series',
  'validReturnDays',
  'totalReturnPct',
  'CAGRpct',
  'maxDrawdownPct',
  'maxUnderwaterDurationDays',
  'avgUnderwaterDurationDays',
  'pctTimeUnderwater',
  'volatilityPct',
  'historicalVaRPct',
  'ewmaMeanPct',
  'ewmaMaxPct',
  'ewmaP95Pct',
  'hedgeActivationEvents',
  'hedgeActivationFrequencyPct',
  'pctDaysHedged',
  'averageHedgeRatioPct',
  'returnSacrificedPct',
  'drawdownReductionPctPoints',
  'volatilityReductionPctPoints',
  'varReductionPctPoints',
  'protectionEfficiencyRatio',
  'volatilityEfficiencyRatio',
  'varEfficiencyRatio'
];

function signalKey(year, date) {
  return `${year}|${date}`;
}

function loadDailyRows() {
  return YEARS.flatMap(item => {
    if (!fs.existsSync(item.input)) throw new Error(`Missing Daily MTM input: ${item.input}`);
    const payload = readJson(item.input);
    return (payload.rows || []).map(row => ({
      ...row,
      year: item.year,
      regime: item.regime
    }));
  }).sort((a, b) => `${a.year}-${a.date}-${a.cycle_id}`.localeCompare(`${b.year}-${b.date}-${b.cycle_id}`));
}

function loadSignals() {
  if (!fs.existsSync(SIGNALS_PATH)) throw new Error(`Missing Passive Hedge Monitoring v0.4b signals: ${SIGNALS_PATH}`);
  return new Map(readCsv(SIGNALS_PATH).map(row => [signalKey(Number(row.year), row.date), row]));
}

function historicalVar(window) {
  if (window.length < 30) return null;
  return percentile(window.slice(-30), 0.05);
}

function buildDailySeries() {
  const rows = loadDailyRows();
  const signals = loadSignals();
  const out = [];
  const unhedgedReturns = [];
  const hedgedReturns = [];
  const unhedgedVarWindow = [];
  const hedgedVarWindow = [];
  let unhedgedEquity = 1;
  let hedgedEquity = 1;
  let unhedgedPeak = 1;
  let hedgedPeak = 1;
  let unhedgedEwmaVar = null;
  let hedgedEwmaVar = null;
  let lastValidAlertState = null;

  for (const row of rows) {
    const signal = signals.get(signalKey(row.year, row.date));
    if (!signal) throw new Error(`Missing v0.4b signal for ${row.year} ${row.date}`);

    const sourceAlertState = signal.alert_state || 'normal';
    const unhedgedReturnPct = optionalNumber(row.daily_return_pct);
    const appliedAlertState = unhedgedReturnPct === null ? null : lastValidAlertState || 'normal';
    const hedgeRatio = appliedAlertState === null ? null : POLICY[appliedAlertState];
    const hedgedReturnPct = unhedgedReturnPct === null ? null : unhedgedReturnPct * (1 - hedgeRatio);
    const unhedgedHistoricalVarPct = historicalVar(unhedgedVarWindow);
    const hedgedHistoricalVarPct = historicalVar(hedgedVarWindow);

    if (unhedgedReturnPct !== null) {
      const unhedgedReturn = unhedgedReturnPct / 100;
      const hedgedReturn = hedgedReturnPct / 100;

      unhedgedEwmaVar = unhedgedEwmaVar === null
        ? unhedgedReturn ** 2
        : LAMBDA * unhedgedEwmaVar + (1 - LAMBDA) * unhedgedReturn ** 2;
      hedgedEwmaVar = hedgedEwmaVar === null
        ? hedgedReturn ** 2
        : LAMBDA * hedgedEwmaVar + (1 - LAMBDA) * hedgedReturn ** 2;

      unhedgedEquity *= (1 + unhedgedReturn);
      hedgedEquity *= (1 + hedgedReturn);
      unhedgedPeak = Math.max(unhedgedPeak, unhedgedEquity);
      hedgedPeak = Math.max(hedgedPeak, hedgedEquity);

      unhedgedReturns.push(unhedgedReturnPct);
      hedgedReturns.push(hedgedReturnPct);
      unhedgedVarWindow.push(unhedgedReturnPct);
      hedgedVarWindow.push(hedgedReturnPct);
    }

    if (optionalNumber(row.approximate_CCW_value) !== null) {
      lastValidAlertState = sourceAlertState;
    }

    out.push({
      date: row.date,
      year: row.year,
      regime: row.regime,
      source_alert_state: sourceAlertState,
      applied_alert_state: appliedAlertState,
      hedge_ratio: hedgeRatio,
      unhedged_daily_return_pct: roundNumber(unhedgedReturnPct),
      hedged_daily_return_pct: roundNumber(hedgedReturnPct),
      unhedged_equity: roundNumber(unhedgedEquity),
      hedged_equity: roundNumber(hedgedEquity),
      unhedged_drawdown_pct: roundNumber(unhedgedPeak > 0 ? (unhedgedEquity / unhedgedPeak - 1) * 100 : null),
      hedged_drawdown_pct: roundNumber(hedgedPeak > 0 ? (hedgedEquity / hedgedPeak - 1) * 100 : null),
      unhedged_ewma_vol_pct: roundNumber(unhedgedEwmaVar === null ? null : Math.sqrt(unhedgedEwmaVar) * 100),
      hedged_ewma_vol_pct: roundNumber(hedgedEwmaVar === null ? null : Math.sqrt(hedgedEwmaVar) * 100),
      unhedged_historical_var_pct: roundNumber(unhedgedHistoricalVarPct),
      hedged_historical_var_pct: roundNumber(hedgedHistoricalVarPct),
      methodology_note: 'hedge ratio uses previous valid MTM alert_state; hedged_return = unhedged_return * (1 - hedge_ratio)'
    });
  }

  return out;
}

function equityStats(rows, prefix) {
  const validRows = rows.filter(row => optionalNumber(row[`${prefix}_daily_return_pct`]) !== null);
  const returns = validRows.map(row => optionalNumber(row[`${prefix}_daily_return_pct`])).filter(Number.isFinite);
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
  const underwaterDurations = [];
  let underwaterDays = 0;

  for (const returnPct of returns) {
    const returnDecimal = returnPct / 100;
    ewmaVar = ewmaVar === null
      ? returnDecimal ** 2
      : LAMBDA * ewmaVar + (1 - LAMBDA) * returnDecimal ** 2;
    ewma.push(Math.sqrt(ewmaVar) * 100);

    equity *= (1 + returnDecimal);
    peak = Math.max(peak, equity);
    const drawdownPct = peak > 0 ? (equity / peak - 1) * 100 : null;
    if (drawdownPct !== null) drawdowns.push(drawdownPct);

    if (drawdownPct !== null && drawdownPct < 0) {
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
    startDate,
    endDate,
    validReturnDays: returns.length,
    totalReturnPct: (equity - 1) * 100,
    CAGRpct: !years || years <= 0 ? null : ((equity ** (1 / years)) - 1) * 100,
    maxDrawdownPct: drawdowns.length ? Math.min(...drawdowns) : null,
    maxUnderwaterDurationDays: maxUnderwater,
    avgUnderwaterDurationDays: underwaterDurations.length ? mean(underwaterDurations) : 0,
    pctTimeUnderwater: validRows.length ? underwaterDays / validRows.length * 100 : null,
    volatilityPct: sampleStdDev(returns),
    historicalVaRPct: percentile(returns, 0.05),
    ewmaMeanPct: mean(ewma),
    ewmaMaxPct: ewma.length ? Math.max(...ewma) : null,
    ewmaP95Pct: percentile(ewma, 0.95)
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

function comparisonRows(scope, rows, year = null, regime = null) {
  const unhedged = equityStats(rows, 'unhedged');
  const hedged = equityStats(rows, 'hedged');
  const hedgeUse = hedgeUseStats(rows);
  const returnSacrificed = unhedged.totalReturnPct - hedged.totalReturnPct;
  const drawdownReduction = Math.abs(unhedged.maxDrawdownPct) - Math.abs(hedged.maxDrawdownPct);
  const volatilityReduction = unhedged.volatilityPct - hedged.volatilityPct;
  const varReduction = Math.abs(unhedged.historicalVaRPct) - Math.abs(hedged.historicalVaRPct);
  const ratios = {
    returnSacrificedPct: returnSacrificed,
    drawdownReductionPctPoints: drawdownReduction,
    volatilityReductionPctPoints: volatilityReduction,
    varReductionPctPoints: varReduction,
    protectionEfficiencyRatio: returnSacrificed > 0 ? drawdownReduction / returnSacrificed : null,
    volatilityEfficiencyRatio: returnSacrificed > 0 ? volatilityReduction / returnSacrificed : null,
    varEfficiencyRatio: returnSacrificed > 0 ? varReduction / returnSacrificed : null
  };

  const base = {
    scope,
    year,
    regime
  };

  return [
    { ...base, series: 'unhedged', ...roundStats(unhedged), hedgeActivationEvents: null, hedgeActivationFrequencyPct: null, pctDaysHedged: null, averageHedgeRatioPct: null, ...emptyEfficiency() },
    { ...base, series: 'hedged_v01', ...roundStats(hedged), ...roundStats(hedgeUse), ...roundStats(ratios) }
  ];
}

function emptyEfficiency() {
  return {
    returnSacrificedPct: null,
    drawdownReductionPctPoints: null,
    volatilityReductionPctPoints: null,
    varReductionPctPoints: null,
    protectionEfficiencyRatio: null,
    volatilityEfficiencyRatio: null,
    varEfficiencyRatio: null
  };
}

function roundStats(stats) {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [
    key,
    typeof value === 'number' ? roundNumber(value) : value
  ]));
}

function yearlySummaries(rows) {
  return YEARS.flatMap(item => {
    const yearRows = rows.filter(row => row.year === item.year);
    return comparisonRows(String(item.year), yearRows, item.year, item.regime);
  });
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildFindings(dailyRows, comparison, yearly) {
  const aggregateHedged = comparison.find(row => row.scope === '2020-2025' && row.series === 'hedged_v01');
  const aggregateUnhedged = comparison.find(row => row.scope === '2020-2025' && row.series === 'unhedged');
  const returnSacrificed = optionalNumber(aggregateHedged.returnSacrificedPct);
  const yearlyHedged = yearly.filter(row => row.series === 'hedged_v01');
  const helpfulYears = yearlyHedged
    .filter(row => optionalNumber(row.drawdownReductionPctPoints) > 0)
    .map(row => `${row.year} (${row.drawdownReductionPctPoints} pp DD reduction)`);
  const lowUseYears = yearlyHedged
    .filter(row => optionalNumber(row.pctDaysHedged) !== null && optionalNumber(row.pctDaysHedged) < 2)
    .map(row => `${row.year} (${row.pctDaysHedged}% hedged days)`);

  return [
    '# Partial Hedge Simulation v0.1',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Strategy: BTC Weekly OTM05.',
    '- Period: Daily Approximate MTM multi-year artifacts, 2020-2025.',
    '- Monitoring input: Passive Hedge Monitoring v0.4b recommended signals.',
    '- Classification: research-grade only.',
    '- This is not an operational hedge policy and does not suggest a real hedge.',
    '',
    '## Policy',
    '',
    '| alert_state | hedge_ratio |',
    '| --- | --- |',
    '| normal | 0% |',
    '| watch | 0% |',
    '| stress | 25% |',
    '| crisis | 50% |',
    '',
    '## Methodology',
    '',
    'The simulation applies the hedge ratio from the previous valid Daily MTM `alert_state` to the next valid daily return. This avoids same-day lookahead from alert fields that may include the current daily return.',
    '',
    'Formula:',
    '',
    '```text',
    'hedged_daily_return = unhedged_daily_return * (1 - hedge_ratio)',
    '```',
    '',
    'Simplifying assumption: the hedge is modeled as proportional exposure reduction on the Daily MTM return stream. No specific hedge instrument is modeled.',
    '',
    'Excluded from this version: funding, basis, slippage, margin, liquidity, collateral, liquidation risk, exchange constraints, and option-greek-aware hedge behavior.',
    '',
    '## Aggregate Comparison',
    '',
    markdownTable(comparison, ['series', 'validReturnDays', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'returnSacrificedPct', 'drawdownReductionPctPoints', 'protectionEfficiencyRatio']),
    '',
    '## Yearly Hedged Summary',
    '',
    markdownTable(yearlyHedged, ['year', 'regime', 'totalReturnPct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'pctDaysHedged', 'averageHedgeRatioPct', 'returnSacrificedPct', 'drawdownReductionPctPoints', 'protectionEfficiencyRatio']),
    '',
    '## Main Findings',
    '',
    `- The v0.1 hedge was active on ${aggregateHedged.pctDaysHedged}% of valid return days with an average hedge ratio of ${aggregateHedged.averageHedgeRatioPct}%.`,
    `- Aggregate total return moved from ${aggregateUnhedged.totalReturnPct}% unhedged to ${aggregateHedged.totalReturnPct}% hedged.`,
    `- Aggregate max drawdown moved from ${aggregateUnhedged.maxDrawdownPct}% unhedged to ${aggregateHedged.maxDrawdownPct}% hedged.`,
    `- Aggregate volatility moved from ${aggregateUnhedged.volatilityPct}% to ${aggregateHedged.volatilityPct}%.`,
    `- Aggregate historical VaR moved from ${aggregateUnhedged.historicalVaRPct}% to ${aggregateHedged.historicalVaRPct}%.`,
    returnSacrificed > 0
      ? `- Return sacrificed was ${aggregateHedged.returnSacrificedPct}% for ${aggregateHedged.drawdownReductionPctPoints} percentage points of drawdown reduction.`
      : `- No aggregate return was sacrificed in this simplified model; hedged total return exceeded unhedged by ${roundNumber(Math.abs(returnSacrificed))} percentage points.`,
    returnSacrificed > 0
      ? `- Protection efficiency ratio was ${aggregateHedged.protectionEfficiencyRatio}.`
      : '- Protection efficiency ratio is not defined because the simplified hedge did not sacrifice aggregate return.',
    helpfulYears.length ? `- Years with clear drawdown help: ${helpfulYears.join(', ')}.` : '- No year showed positive drawdown reduction under this simplified policy.',
    lowUseYears.length ? `- Years where hedge looked mostly unnecessary by activation: ${lowUseYears.join(', ')}.` : '- No year had trivially low hedge usage.',
    '',
    '## Interpretation',
    '',
    '- The result should be read as a first economic screen, not as evidence of final hedge viability.',
    '- A positive risk reduction with limited return sacrifice would justify realistic hedge economics in Phase 4.',
    '- A weak or unstable protection-efficiency ratio would suggest revisiting hedge intensity or alert-state mapping before adding costs.',
    '',
    '## Limitations',
    '',
    '- Proportional exposure reduction is a simplification and may not match futures/perpetual hedge PnL.',
    '- The model uses previous valid Daily MTM state to avoid lookahead, but it does not model execution timing within the day.',
    '- Missing Daily MTM gaps remain inherited from the source artifacts.',
    '- Costs and implementation constraints are intentionally excluded.',
    '- BTC overlay hedge behavior may diverge from full CCW portfolio sensitivity because option greeks are not modeled.',
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  if (process.argv.includes('--force')) return;
  const outputs = [
    OUTPUT_DAILY_CSV,
    OUTPUT_DAILY_JSON,
    OUTPUT_YEARLY_CSV,
    OUTPUT_YEARLY_JSON,
    OUTPUT_COMPARISON_CSV,
    OUTPUT_COMPARISON_JSON,
    OUTPUT_FINDINGS_MD
  ];
  const existing = outputs.filter(file => fs.existsSync(file));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing hedge simulation outputs: ${existing.map(file => path.relative(REPO_ROOT, file)).join(', ')}`);
  }
}

function main() {
  assertNoOverwrite();
  const dailyRows = buildDailySeries();
  const comparison = comparisonRows('2020-2025', dailyRows);
  const yearly = yearlySummaries(dailyRows);
  const metadata = {
    generatedAt: new Date().toISOString(),
    classification: 'research-grade only',
    strategy: {
      asset: 'BTC',
      tenor: 'weekly',
      moneyness: 'OTM05',
      period: '2020-2025'
    },
    monitoringInput: path.relative(REPO_ROOT, SIGNALS_PATH),
    methodology: {
      formula: 'hedged_daily_return = unhedged_daily_return * (1 - hedge_ratio)',
      timing: 'previous valid Daily MTM alert_state is applied to the next valid daily return to avoid same-day lookahead',
      simplification: 'proportional exposure reduction on Daily MTM returns',
      excluded: ['funding', 'basis', 'slippage', 'margin', 'liquidity', 'collateral', 'liquidation', 'exchange constraints', 'option greeks']
    },
    policy: POLICY
  };

  fs.mkdirSync(OUTPUT_SIM_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_DAILY_CSV, `${objectsToCsv(dailyRows, DAILY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_DAILY_JSON, `${JSON.stringify({ metadata, rows: dailyRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(yearly, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_JSON, `${JSON.stringify({ metadata, rows: yearly }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_CSV, `${objectsToCsv(comparison, COMPARISON_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_JSON, `${JSON.stringify({ metadata, rows: comparison }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildFindings(dailyRows, comparison, yearly), 'utf8');

  for (const file of [OUTPUT_DAILY_CSV, OUTPUT_DAILY_JSON, OUTPUT_YEARLY_CSV, OUTPUT_YEARLY_JSON, OUTPUT_COMPARISON_CSV, OUTPUT_COMPARISON_JSON, OUTPUT_FINDINGS_MD]) {
    console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building partial hedge simulation v0.1:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  POLICY,
  buildDailySeries,
  comparisonRows,
  yearlySummaries
};
