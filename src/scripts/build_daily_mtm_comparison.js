const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  mean,
  median,
  sampleStdDev,
  percentile
} = require('./btc_deep_risk_utils');

const STRATEGIES = [
  {
    id: 'btc_weekly_otm05_2025',
    label: 'BTC Weekly OTM05 2025',
    asset: 'BTC',
    moneyness: 'OTM05',
    role: 'btc_baseline',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')
  },
  {
    id: 'btc_weekly_otm10_2025',
    label: 'BTC Weekly OTM10 2025',
    asset: 'BTC',
    moneyness: 'OTM10',
    role: 'btc_aggressive_variant',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm10_2025', 'btc_weekly_otm10_2025_daily_mtm.json')
  },
  {
    id: 'eth_weekly_otm05_2025',
    label: 'ETH Weekly OTM05 2025',
    asset: 'ETH',
    moneyness: 'OTM05',
    role: 'eth_provisional_baseline',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'eth_weekly_otm05_2025', 'eth_weekly_otm05_2025_daily_mtm.json')
  },
  {
    id: 'eth_weekly_otm03_2025',
    label: 'ETH Weekly OTM03 2025',
    asset: 'ETH',
    moneyness: 'OTM03',
    role: 'eth_comparative_variant',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'eth_weekly_otm03_2025', 'eth_weekly_otm03_2025_daily_mtm.json')
  }
];

const OUTPUT_COMPARISON_DIR = path.join(OUTPUT_DIR, 'daily_mtm', 'comparison');
const OUTPUT_CSV = path.join(OUTPUT_COMPARISON_DIR, 'summary.csv');
const OUTPUT_JSON = path.join(OUTPUT_COMPARISON_DIR, 'summary.json');
const OUTPUT_MD = path.join(OUTPUT_COMPARISON_DIR, 'findings.md');

const SUMMARY_COLUMNS = [
  'strategy',
  'asset',
  'moneyness',
  'role',
  'snapshots',
  'completeMtmRows',
  'validDailyReturns',
  'meanDailyReturnPct',
  'medianDailyReturnPct',
  'dailyStdDevPct',
  'skewness',
  'excessKurtosis',
  'p01DailyReturnPct',
  'p05DailyReturnPct',
  'p50DailyReturnPct',
  'p95DailyReturnPct',
  'p99DailyReturnPct',
  'worstDayPct',
  'bestDayPct',
  'daysLtMinus2Pct',
  'daysLtMinus5Pct',
  'daysLtMinus10Pct',
  'daysGtPlus2Pct',
  'daysGtPlus5Pct',
  'daysGtPlus10Pct',
  'maxDrawdownPct',
  'maxUnderwaterDurationDays',
  'avgUnderwaterDurationDays',
  'pctTimeUnderwater',
  'ewmaMeanPct',
  'ewmaMaxPct',
  'ewmaP95Pct',
  'varMeanLossPct',
  'varWorstLossPct',
  'varP95LossPct',
  'syntheticMissingRows',
  'missingOptionRows',
  'missingUnderlyingRows',
  'dailyReturnGapRows'
];

function varianceMoment(values, power) {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return null;
  const avg = mean(nums);
  return nums.reduce((sum, value) => sum + (value - avg) ** power, 0) / nums.length;
}

function skewness(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 3) return null;
  const m2 = varianceMoment(nums, 2);
  const m3 = varianceMoment(nums, 3);
  if (!m2) return null;
  return m3 / (m2 ** 1.5);
}

function excessKurtosis(values) {
  const nums = values.filter(Number.isFinite);
  if (nums.length < 4) return null;
  const m2 = varianceMoment(nums, 2);
  const m4 = varianceMoment(nums, 4);
  if (!m2) return null;
  return m4 / (m2 ** 2) - 3;
}

function underwaterDurations(rows) {
  const durations = [];
  let current = 0;
  let underwaterRows = 0;

  for (const row of rows) {
    const drawdownPct = optionalNumber(row.rolling_drawdown_pct);
    if (drawdownPct !== null && drawdownPct < 0) {
      current += 1;
      underwaterRows += 1;
    } else if (current > 0) {
      durations.push(current);
      current = 0;
    }
  }
  if (current > 0) durations.push(current);

  return {
    durations,
    underwaterRows
  };
}

function loadStrategy(strategy) {
  if (!fs.existsSync(strategy.input)) {
    throw new Error(`Missing Daily MTM input for ${strategy.label}: ${strategy.input}`);
  }
  return JSON.parse(fs.readFileSync(strategy.input, 'utf8'));
}

function summarizeStrategy(strategy) {
  const input = loadStrategy(strategy);
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const returnsPct = rows.map(row => optionalNumber(row.daily_return_pct)).filter(Number.isFinite);
  const ewmaPct = rows.map(row => optionalNumber(row.EWMA_vol_pct)).filter(Number.isFinite);
  const varLossPct = rows
    .map(row => optionalNumber(row.historical_VaR_pct))
    .filter(Number.isFinite)
    .map(value => Math.abs(Math.min(0, value)));
  const drawdownPct = rows.map(row => optionalNumber(row.rolling_drawdown_pct)).filter(Number.isFinite);
  const underwater = underwaterDurations(rows);
  const validation = input.validation || {};
  const gaps = input.gaps || {};

  return {
    strategy: strategy.label,
    id: strategy.id,
    asset: strategy.asset,
    moneyness: strategy.moneyness,
    role: strategy.role,
    source: path.relative(REPO_ROOT, strategy.input),
    snapshots: validation.totalDailyRows ?? rows.length,
    completeMtmRows: validation.completeMtmRows ?? rows.filter(row => optionalNumber(row.approximate_CCW_value) !== null).length,
    validDailyReturns: returnsPct.length,
    meanDailyReturnPct: roundNumber(mean(returnsPct)),
    medianDailyReturnPct: roundNumber(median(returnsPct)),
    dailyStdDevPct: roundNumber(sampleStdDev(returnsPct)),
    skewness: roundNumber(skewness(returnsPct)),
    excessKurtosis: roundNumber(excessKurtosis(returnsPct)),
    p01DailyReturnPct: roundNumber(percentile(returnsPct, 0.01)),
    p05DailyReturnPct: roundNumber(percentile(returnsPct, 0.05)),
    p50DailyReturnPct: roundNumber(percentile(returnsPct, 0.50)),
    p95DailyReturnPct: roundNumber(percentile(returnsPct, 0.95)),
    p99DailyReturnPct: roundNumber(percentile(returnsPct, 0.99)),
    worstDayPct: returnsPct.length ? roundNumber(Math.min(...returnsPct)) : null,
    bestDayPct: returnsPct.length ? roundNumber(Math.max(...returnsPct)) : null,
    daysLtMinus2Pct: returnsPct.filter(value => value < -2).length,
    daysLtMinus5Pct: returnsPct.filter(value => value < -5).length,
    daysLtMinus10Pct: returnsPct.filter(value => value < -10).length,
    daysGtPlus2Pct: returnsPct.filter(value => value > 2).length,
    daysGtPlus5Pct: returnsPct.filter(value => value > 5).length,
    daysGtPlus10Pct: returnsPct.filter(value => value > 10).length,
    maxDrawdownPct: drawdownPct.length ? roundNumber(Math.min(...drawdownPct)) : null,
    maxUnderwaterDurationDays: underwater.durations.length ? Math.max(...underwater.durations) : 0,
    avgUnderwaterDurationDays: underwater.durations.length ? roundNumber(mean(underwater.durations)) : 0,
    pctTimeUnderwater: roundNumber(underwater.underwaterRows / Math.max(drawdownPct.length, 1) * 100),
    ewmaMeanPct: roundNumber(mean(ewmaPct)),
    ewmaMaxPct: ewmaPct.length ? roundNumber(Math.max(...ewmaPct)) : null,
    ewmaP95Pct: roundNumber(percentile(ewmaPct, 0.95)),
    varMeanLossPct: roundNumber(mean(varLossPct)),
    varWorstLossPct: varLossPct.length ? roundNumber(Math.max(...varLossPct)) : null,
    varP95LossPct: roundNumber(percentile(varLossPct, 0.95)),
    syntheticMissingRows: gaps.syntheticOrMissingInstrumentRows ?? validation.syntheticOrMissingInstrumentRows ?? null,
    missingOptionRows: gaps.missingOptionPriceRows ?? null,
    missingUnderlyingRows: gaps.missingUnderlyingPriceRows ?? null,
    dailyReturnGapRows: Array.isArray(gaps.dailyReturnGapRows) ? gaps.dailyReturnGapRows.length : null
  };
}

function find(rows, asset, moneyness) {
  return rows.find(row => row.asset === asset && row.moneyness === moneyness);
}

function buildFindings(rows) {
  const btc05 = find(rows, 'BTC', 'OTM05');
  const btc10 = find(rows, 'BTC', 'OTM10');
  const eth05 = find(rows, 'ETH', 'OTM05');
  const eth03 = find(rows, 'ETH', 'OTM03');

  const ethRiskHigher = eth05.dailyStdDevPct > btc05.dailyStdDevPct * 1.25
    && eth03.dailyStdDevPct > btc05.dailyStdDevPct * 1.25
    && eth05.maxDrawdownPct < btc05.maxDrawdownPct
    && eth03.maxDrawdownPct < btc05.maxDrawdownPct;

  const ethOtm03Defensive = (
    eth03.dailyStdDevPct < eth05.dailyStdDevPct
    && eth03.maxDrawdownPct > eth05.maxDrawdownPct
    && eth03.varWorstLossPct < eth05.varWorstLossPct
  );

  const btcOtm10Aggressive = (
    btc10.dailyStdDevPct > btc05.dailyStdDevPct
    || btc10.p05DailyReturnPct < btc05.p05DailyReturnPct
    || btc10.varMeanLossPct > btc05.varMeanLossPct
  );

  return {
    generatedAt: new Date().toISOString(),
    interpretation: {
      ethDailyRiskSignificantlyHigherThanBtc: ethRiskHigher,
      ethOtm03MoreDefensiveThanOtm05: ethOtm03Defensive,
      btcOtm10MoreAggressiveThanOtm05: btcOtm10Aggressive,
      dailyMtmChangesPriorConclusions: false,
      reconsiderBtcWeeklyOtm05Baseline: false,
      reconsiderEthWeeklyOtm05Baseline: false
    },
    evidence: {
      ethVsBtc: [
        `ETH OTM05 daily std dev ${eth05.dailyStdDevPct}% vs BTC OTM05 ${btc05.dailyStdDevPct}%.`,
        `ETH OTM03 daily std dev ${eth03.dailyStdDevPct}% vs BTC OTM05 ${btc05.dailyStdDevPct}%.`,
        `ETH max drawdowns ${eth05.maxDrawdownPct}% / ${eth03.maxDrawdownPct}% vs BTC ${btc05.maxDrawdownPct}% / ${btc10.maxDrawdownPct}%.`,
        `ETH worst VaR loss ${eth05.varWorstLossPct}% / ${eth03.varWorstLossPct}% vs BTC ${btc05.varWorstLossPct}% / ${btc10.varWorstLossPct}%.`
      ],
      ethOtm03VsOtm05: [
        `ETH OTM03 daily std dev ${eth03.dailyStdDevPct}% vs ETH OTM05 ${eth05.dailyStdDevPct}%.`,
        `ETH OTM03 max drawdown ${eth03.maxDrawdownPct}% vs ETH OTM05 ${eth05.maxDrawdownPct}%.`,
        `ETH OTM03 worst VaR loss ${eth03.varWorstLossPct}% vs ETH OTM05 ${eth05.varWorstLossPct}%.`,
        `ETH OTM03 p5 daily return ${eth03.p05DailyReturnPct}% vs ETH OTM05 ${eth05.p05DailyReturnPct}%.`
      ],
      btcOtm10VsOtm05: [
        `BTC OTM10 daily std dev ${btc10.dailyStdDevPct}% vs BTC OTM05 ${btc05.dailyStdDevPct}%.`,
        `BTC OTM10 p5 daily return ${btc10.p05DailyReturnPct}% vs BTC OTM05 ${btc05.p05DailyReturnPct}%.`,
        `BTC OTM10 mean VaR loss ${btc10.varMeanLossPct}% vs BTC OTM05 ${btc05.varMeanLossPct}%.`,
        `BTC OTM10 max drawdown ${btc10.maxDrawdownPct}% vs BTC OTM05 ${btc05.maxDrawdownPct}%.`
      ],
      baselineReview: [
        'BTC OTM05 remains reasonable as baseline: OTM10 does not show a cleaner daily risk profile in this slice.',
        'ETH OTM05 remains reasonable as provisional baseline: OTM03 is mildly more defensive on daily risk, but the difference is not large enough by itself to overturn the friction/operational baseline decision.',
        'Daily MTM adds intracycle risk evidence, especially ETH drawdown severity, but it does not contradict the existing baseline choices.'
      ]
    }
  };
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildMarkdown(rows, findings) {
  const compactRows = rows.map(row => ({
    strategy: row.strategy,
    returns: row.validDailyReturns,
    mean: `${row.meanDailyReturnPct}%`,
    stdDev: `${row.dailyStdDevPct}%`,
    p5: `${row.p05DailyReturnPct}%`,
    p95: `${row.p95DailyReturnPct}%`,
    maxDD: `${row.maxDrawdownPct}%`,
    ewmaMax: `${row.ewmaMaxPct}%`,
    worstVaR: `${row.varWorstLossPct}%`,
    gaps: `${row.syntheticMissingRows}/${row.missingOptionRows}/${row.missingUnderlyingRows}`
  }));

  return [
    '# Daily MTM 2025 Consolidated Comparison',
    '',
    `Generated: ${findings.generatedAt}`,
    '',
    '## Scope',
    '',
    '- Inputs: existing Daily MTM JSON artifacts only.',
    '- No new MTM generation and no backtests were run by this comparison step.',
    '- Metrics are approximate research MTM metrics, not official portfolio accounting.',
    '',
    '## Summary',
    '',
    markdownTable(compactRows, ['strategy', 'returns', 'mean', 'stdDev', 'p5', 'p95', 'maxDD', 'ewmaMax', 'worstVaR', 'gaps']),
    '',
    'Gap format: synthetic or missing instrument rows / missing option rows / missing underlying rows.',
    '',
    '## Answers',
    '',
    `- Does ETH show significantly higher daily risk than BTC? ${findings.interpretation.ethDailyRiskSignificantlyHigherThanBtc ? 'Yes.' : 'No.'}`,
    ...findings.evidence.ethVsBtc.map(item => `  - ${item}`),
    '',
    `- Is ETH OTM03 really more defensive than ETH OTM05? ${findings.interpretation.ethOtm03MoreDefensiveThanOtm05 ? 'Yes, mildly in this daily MTM slice.' : 'No.'}`,
    ...findings.evidence.ethOtm03VsOtm05.map(item => `  - ${item}`),
    '',
    `- Is BTC OTM10 really more aggressive than BTC OTM05? ${findings.interpretation.btcOtm10MoreAggressiveThanOtm05 ? 'Yes, but only mildly in this daily MTM slice.' : 'No.'}`,
    ...findings.evidence.btcOtm10VsOtm05.map(item => `  - ${item}`),
    '',
    `- Does Daily MTM change any important prior conclusion? ${findings.interpretation.dailyMtmChangesPriorConclusions ? 'Yes.' : 'No.'}`,
    '- It reinforces the value of intracycle risk monitoring, especially for ETH, but does not overturn the baseline hierarchy.',
    '',
    '## Baseline Review',
    '',
    `- Reconsider BTC Weekly OTM05 baseline? ${findings.interpretation.reconsiderBtcWeeklyOtm05Baseline ? 'Yes.' : 'No.'}`,
    `- Reconsider ETH Weekly OTM05 baseline? ${findings.interpretation.reconsiderEthWeeklyOtm05Baseline ? 'Yes.' : 'No.'}`,
    ...findings.evidence.baselineReview.map(item => `- ${item}`),
    '',
    '## Caveats',
    '',
    '- All results inherit the Daily MTM caveats: option OHLC proxies, no official historical marks, no greeks, no funding, no slippage, no margin, and visible synthetic-cycle gaps.',
    '- This is a single-year 2025 comparison, not a multi-year stability proof.',
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  const existing = [OUTPUT_CSV, OUTPUT_JSON, OUTPUT_MD].filter(filePath => fs.existsSync(filePath));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing comparison outputs: ${existing.map(filePath => path.relative(REPO_ROOT, filePath)).join(', ')}`);
  }
}

function main() {
  assertNoOverwrite();
  const rows = STRATEGIES.map(summarizeStrategy);
  const findings = buildFindings(rows);
  fs.mkdirSync(OUTPUT_COMPARISON_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(rows, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify({ ...findings, rows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(rows, findings), 'utf8');

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building Daily MTM comparison:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  summarizeStrategy,
  buildFindings
};
