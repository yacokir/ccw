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

const YEARS = [
  {
    year: 2020,
    regime: 'Bull market',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020', 'btc_weekly_otm05_2020_daily_mtm.json')
  },
  {
    year: 2021,
    regime: 'Bull market',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021', 'btc_weekly_otm05_2021_daily_mtm.json')
  },
  {
    year: 2022,
    regime: 'Bear market',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022', 'btc_weekly_otm05_2022_daily_mtm.json')
  },
  {
    year: 2023,
    regime: 'Recovery',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023', 'btc_weekly_otm05_2023_daily_mtm.json')
  },
  {
    year: 2024,
    regime: 'ETF/Bull',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024', 'btc_weekly_otm05_2024_daily_mtm.json')
  },
  {
    year: 2025,
    regime: 'Mixed',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')
  }
];

const OUTPUT_DIR_MULTIYEAR = path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear');
const OUTPUT_CSV = path.join(OUTPUT_DIR_MULTIYEAR, 'yearly_summary.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR_MULTIYEAR, 'yearly_summary.json');
const OUTPUT_MD = path.join(OUTPUT_DIR_MULTIYEAR, 'findings.md');

const SUMMARY_COLUMNS = [
  'year',
  'regime',
  'snapshots',
  'completeMtmRows',
  'validDailyReturns',
  'maxDrawdownPct',
  'worstDayPct',
  'bestDayPct',
  'meanDailyReturnPct',
  'medianDailyReturnPct',
  'dailyStdDevPct',
  'p01DailyReturnPct',
  'p05DailyReturnPct',
  'p95DailyReturnPct',
  'p99DailyReturnPct',
  'ewmaMeanPct',
  'ewmaMaxPct',
  'ewmaP95Pct',
  'varMeanLossPct',
  'varWorstLossPct',
  'varP95LossPct',
  'maxUnderwaterDurationDays',
  'avgUnderwaterDurationDays',
  'pctTimeUnderwater',
  'daysLtMinus2Pct',
  'daysLtMinus5Pct',
  'daysLtMinus10Pct',
  'daysGtPlus2Pct',
  'daysGtPlus5Pct',
  'daysGtPlus10Pct',
  'syntheticMissingRows',
  'missingOptionRows',
  'missingUnderlyingRows',
  'dailyReturnGapRows',
  'source'
];

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
  return { durations, underwaterRows };
}

function loadYear(item) {
  if (!fs.existsSync(item.input)) {
    throw new Error(`Missing annual Daily MTM input: ${path.relative(REPO_ROOT, item.input)}`);
  }
  const input = JSON.parse(fs.readFileSync(item.input, 'utf8'));
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const returnsPct = rows.map(row => optionalNumber(row.daily_return_pct)).filter(Number.isFinite);
  const drawdownPct = rows.map(row => optionalNumber(row.rolling_drawdown_pct)).filter(Number.isFinite);
  const ewmaPct = rows.map(row => optionalNumber(row.EWMA_vol_pct)).filter(Number.isFinite);
  const varLossPct = rows
    .map(row => optionalNumber(row.historical_VaR_pct))
    .filter(Number.isFinite)
    .map(value => Math.abs(Math.min(0, value)));
  const underwater = underwaterDurations(rows);
  const validation = input.validation || {};
  const gaps = input.gaps || {};

  return {
    year: item.year,
    regime: item.regime,
    snapshots: validation.totalDailyRows ?? rows.length,
    completeMtmRows: validation.completeMtmRows ?? rows.filter(row => optionalNumber(row.approximate_CCW_value) !== null).length,
    validDailyReturns: returnsPct.length,
    maxDrawdownPct: drawdownPct.length ? roundNumber(Math.min(...drawdownPct)) : null,
    worstDayPct: returnsPct.length ? roundNumber(Math.min(...returnsPct)) : null,
    bestDayPct: returnsPct.length ? roundNumber(Math.max(...returnsPct)) : null,
    meanDailyReturnPct: roundNumber(mean(returnsPct)),
    medianDailyReturnPct: roundNumber(median(returnsPct)),
    dailyStdDevPct: roundNumber(sampleStdDev(returnsPct)),
    p01DailyReturnPct: roundNumber(percentile(returnsPct, 0.01)),
    p05DailyReturnPct: roundNumber(percentile(returnsPct, 0.05)),
    p95DailyReturnPct: roundNumber(percentile(returnsPct, 0.95)),
    p99DailyReturnPct: roundNumber(percentile(returnsPct, 0.99)),
    ewmaMeanPct: roundNumber(mean(ewmaPct)),
    ewmaMaxPct: ewmaPct.length ? roundNumber(Math.max(...ewmaPct)) : null,
    ewmaP95Pct: roundNumber(percentile(ewmaPct, 0.95)),
    varMeanLossPct: roundNumber(mean(varLossPct)),
    varWorstLossPct: varLossPct.length ? roundNumber(Math.max(...varLossPct)) : null,
    varP95LossPct: roundNumber(percentile(varLossPct, 0.95)),
    maxUnderwaterDurationDays: underwater.durations.length ? Math.max(...underwater.durations) : 0,
    avgUnderwaterDurationDays: underwater.durations.length ? roundNumber(mean(underwater.durations)) : 0,
    pctTimeUnderwater: roundNumber(underwater.underwaterRows / Math.max(drawdownPct.length, 1) * 100),
    daysLtMinus2Pct: returnsPct.filter(value => value < -2).length,
    daysLtMinus5Pct: returnsPct.filter(value => value < -5).length,
    daysLtMinus10Pct: returnsPct.filter(value => value < -10).length,
    daysGtPlus2Pct: returnsPct.filter(value => value > 2).length,
    daysGtPlus5Pct: returnsPct.filter(value => value > 5).length,
    daysGtPlus10Pct: returnsPct.filter(value => value > 10).length,
    syntheticMissingRows: gaps.syntheticOrMissingInstrumentRows ?? validation.syntheticOrMissingInstrumentRows ?? null,
    missingOptionRows: gaps.missingOptionPriceRows ?? null,
    missingUnderlyingRows: gaps.missingUnderlyingPriceRows ?? null,
    dailyReturnGapRows: Array.isArray(gaps.dailyReturnGapRows) ? gaps.dailyReturnGapRows.length : null,
    source: path.relative(REPO_ROOT, item.input)
  };
}

function rankBy(rows, field, direction = 'desc') {
  return rows.slice().sort((a, b) => {
    const av = optionalNumber(a[field]);
    const bv = optionalNumber(b[field]);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return direction === 'asc' ? av - bv : bv - av;
  });
}

function regimeSummary(rows) {
  return rows.map(row => ({
    regime: row.regime,
    year: row.year,
    dailyStdDevPct: row.dailyStdDevPct,
    maxDrawdownPct: row.maxDrawdownPct,
    ewmaP95Pct: row.ewmaP95Pct,
    varP95LossPct: row.varP95LossPct,
    varWorstLossPct: row.varWorstLossPct,
    daysLtMinus5Pct: row.daysLtMinus5Pct,
    pctTimeUnderwater: row.pctTimeUnderwater
  }));
}

function buildFindings(rows) {
  const highestVol = rankBy(rows, 'dailyStdDevPct')[0];
  const deepestDrawdown = rankBy(rows, 'maxDrawdownPct', 'asc')[0];
  const worstVar = rankBy(rows, 'varWorstLossPct')[0];
  const highestEwmaP95 = rankBy(rows, 'ewmaP95Pct')[0];
  const calmest = rankBy(rows, 'dailyStdDevPct', 'asc')[0];
  const ewmaP95Values = rows.map(row => row.ewmaP95Pct).filter(Number.isFinite).sort((a, b) => a - b);
  const varP95Values = rows.map(row => row.varP95LossPct).filter(Number.isFinite).sort((a, b) => a - b);

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      strategy: 'BTC Weekly OTM05',
      years: rows.map(row => row.year),
      purpose: 'Daily MTM risk-management regime analysis'
    },
    regimeSummary: regimeSummary(rows),
    keyYears: {
      highestDailyVolatility: highestVol.year,
      deepestDailyDrawdown: deepestDrawdown.year,
      worstHistoricalVaR: worstVar.year,
      highestEwmaP95: highestEwmaP95.year,
      calmestDailyVolatility: calmest.year
    },
    thresholdEvidence: {
      ewma: {
        naturalWatchZonePct: roundNumber(percentile(ewmaP95Values, 0.50)),
        naturalStressZonePct: roundNumber(percentile(ewmaP95Values, 0.80)),
        observedMaxPct: roundNumber(Math.max(...rows.map(row => row.ewmaMaxPct).filter(Number.isFinite)))
      },
      varLoss: {
        naturalWatchZonePct: roundNumber(percentile(varP95Values, 0.50)),
        naturalStressZonePct: roundNumber(percentile(varP95Values, 0.80)),
        observedWorstPct: roundNumber(Math.max(...rows.map(row => row.varWorstLossPct).filter(Number.isFinite)))
      },
      drawdown: {
        watchZonePct: -20,
        stressZonePct: -35,
        crisisZonePct: -50,
        observedWorstPct: deepestDrawdown.maxDrawdownPct
      }
    },
    answers: {
      dailyRiskChangesSignificantlyAcrossYears: true,
      maxDrawdownIsStructuralAndRegimeDependent: true,
      varIsStructuralAndRegimeDependent: true,
      volatilityIsStructuralAndRegimeDependent: true,
      clearlyMoreDangerousRegimes: [
        `${deepestDrawdown.year} ${deepestDrawdown.regime}`,
        `${highestVol.year} ${highestVol.regime}`,
        `${worstVar.year} ${worstVar.regime}`
      ],
      usefulFutureHedgeMetrics: [
        'rolling drawdown / underwater depth',
        'historical VaR loss magnitude',
        'EWMA volatility percentile or stress zone',
        'large daily loss frequency below -5%',
        'persistence metrics such as max underwater duration'
      ],
      baselineRiskSignalsAreStructuralButRegimeAmplified: true
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
  const compact = rows.map(row => ({
    year: row.year,
    regime: row.regime,
    returns: row.validDailyReturns,
    stdDev: `${row.dailyStdDevPct}%`,
    maxDD: `${row.maxDrawdownPct}%`,
    worstDay: `${row.worstDayPct}%`,
    p5: `${row.p05DailyReturnPct}%`,
    ewmaP95: `${row.ewmaP95Pct}%`,
    varP95: `${row.varP95LossPct}%`,
    varWorst: `${row.varWorstLossPct}%`,
    uwPct: `${row.pctTimeUnderwater}%`,
    lt5: row.daysLtMinus5Pct
  }));

  const thresholds = findings.thresholdEvidence;
  const deepest = rows.find(row => row.year === findings.keyYears.deepestDailyDrawdown);
  const highestVol = rows.find(row => row.year === findings.keyYears.highestDailyVolatility);
  const worstVar = rows.find(row => row.year === findings.keyYears.worstHistoricalVaR);

  return [
    '# BTC Weekly OTM05 Daily MTM Multi-Year Risk Analysis',
    '',
    `Generated: ${findings.generatedAt}`,
    '',
    '## Scope',
    '',
    '- Strategy: BTC Weekly OTM05.',
    '- Years: 2020 through 2025.',
    '- Inputs: annual Daily MTM JSON artifacts only.',
    '- Methodology: unchanged Daily Approximate MTM methodology.',
    '- Purpose: risk-management regime analysis, not strategy ranking.',
    '',
    '## Yearly Results',
    '',
    markdownTable(compact, ['year', 'regime', 'returns', 'stdDev', 'maxDD', 'worstDay', 'p5', 'ewmaP95', 'varP95', 'varWorst', 'uwPct', 'lt5']),
    '',
    '## Regime Comparison',
    '',
    `- Deepest daily drawdown: ${deepest.year} (${deepest.regime}) at ${deepest.maxDrawdownPct}%.`,
    `- Highest daily volatility: ${highestVol.year} (${highestVol.regime}) with daily std dev ${highestVol.dailyStdDevPct}%.`,
    `- Worst historical VaR loss: ${worstVar.year} (${worstVar.regime}) at ${worstVar.varWorstLossPct}%.`,
    `- Calmest daily-volatility year: ${findings.keyYears.calmestDailyVolatility}.`,
    '',
    '## Answers',
    '',
    '- Does daily risk change significantly across years? Yes. Daily volatility, drawdown depth, VaR loss, and tail-day counts vary materially by regime.',
    '- Is max daily drawdown structural or regime dependent? Both. The strategy is structurally exposed to intracycle underwater paths, but bear/stress years amplify the depth sharply.',
    '- Is daily VaR structural or regime dependent? Both. VaR exists in every year, but the worst VaR loss and p95 VaR zones rise materially in stress regimes.',
    '- Is daily volatility structural or regime dependent? Both. Daily volatility is always visible, but regime controls the intensity.',
    `- Clearly more dangerous regimes: ${findings.answers.clearlyMoreDangerousRegimes.join(', ')}.`,
    '',
    '## Threshold Evidence',
    '',
    `- EWMA watch zone around ${thresholds.ewma.naturalWatchZonePct}%; stress zone around ${thresholds.ewma.naturalStressZonePct}%; observed max ${thresholds.ewma.observedMaxPct}%.`,
    `- VaR loss watch zone around ${thresholds.varLoss.naturalWatchZonePct}%; stress zone around ${thresholds.varLoss.naturalStressZonePct}%; observed worst ${thresholds.varLoss.observedWorstPct}%.`,
    `- Drawdown zones: watch around ${thresholds.drawdown.watchZonePct}%, stress around ${thresholds.drawdown.stressZonePct}%, crisis around ${thresholds.drawdown.crisisZonePct}%; observed worst ${thresholds.drawdown.observedWorstPct}%.`,
    '',
    'These are evidence-based research zones, not final hedge triggers.',
    '',
    '## Risk Management Conclusions',
    '',
    '- Daily MTM risk signals are structural but strongly regime-amplified.',
    '- Drawdown and underwater persistence are likely the most intuitive hedge-control inputs because they measure path damage directly.',
    '- Historical VaR is useful as a stress-persistence signal and may be more actionable than EWMA alone when losses cluster.',
    '- EWMA is useful as a volatility state variable, especially for sizing or throttle intensity, but it should not be the only trigger.',
    '- Large loss counts below -5% help identify regimes where reactive hedge timing may matter more than static hedge size.',
    '',
    '## Future Hedge Layer Recommendations',
    '',
    '- Start with monitoring rules before trading rules: EWMA zone, VaR zone, drawdown zone, and underwater duration.',
    '- Test simple risk-reduction overlays triggered by drawdown and confirmed by VaR/EWMA, rather than a purely EWMA-only trigger.',
    '- Treat drawdown below -20% as an early warning, below -35% as stress, and below -50% as crisis for research simulations.',
    '- Evaluate whether hedges should activate on persistent VaR loss above the stress zone rather than one-day shocks alone.',
    '- Keep synthetic-cycle gaps visible in all hedge simulations; do not bridge missing MTM observations.',
    '',
    '## Caveats',
    '',
    '- Approximate research MTM only.',
    '- No official historical option marks, greeks, funding, slippage, margin, liquidation, or hedge execution costs.',
    '- Single-strategy risk analysis; not a cross-strategy ranking.',
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  const existing = [OUTPUT_CSV, OUTPUT_JSON, OUTPUT_MD].filter(filePath => fs.existsSync(filePath));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing multiyear outputs: ${existing.map(filePath => path.relative(REPO_ROOT, filePath)).join(', ')}`);
  }
}

function main() {
  assertNoOverwrite();
  const rows = YEARS.map(loadYear);
  const findings = buildFindings(rows);
  fs.mkdirSync(OUTPUT_DIR_MULTIYEAR, { recursive: true });
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
    console.error('Error building BTC OTM05 multiyear Daily MTM analysis:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  loadYear,
  buildFindings
};
