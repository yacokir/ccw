const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  mean,
  median
} = require('./btc_deep_risk_utils');

const YEARS = [
  ['2020', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020', 'btc_weekly_otm05_2020_daily_mtm.json')],
  ['2021', 'Bull market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021', 'btc_weekly_otm05_2021_daily_mtm.json')],
  ['2022', 'Bear market', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022', 'btc_weekly_otm05_2022_daily_mtm.json')],
  ['2023', 'Recovery', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023', 'btc_weekly_otm05_2023_daily_mtm.json')],
  ['2024', 'ETF/Bull', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024', 'btc_weekly_otm05_2024_daily_mtm.json')],
  ['2025', 'Mixed', path.join(OUTPUT_DIR, 'daily_mtm', 'btc_weekly_otm05_2025', 'btc_weekly_otm05_2025_daily_mtm.json')]
].map(([year, regime, input]) => ({ year: Number(year), regime, input }));

const CONFIGS = [
  {
    id: 'current_v0_1',
    label: 'Current thresholds',
    description: 'Original passive monitor thresholds.',
    thresholds: {
      drawdownPct: { watch: -20, stress: -35, crisis: -50 },
      ewmaVolPct: { watch: 4.25, stress: 6.00, crisis: 7.50 },
      historicalVaRLossPct: { watch: 6.00, stress: 10.00, crisis: 11.50 },
      dailyReturnPct: { watch: -2, stress: -5, crisis: -10 },
      underwaterDurationDays: { watch: 14, stress: 21, crisis: 28 }
    },
    tailFrequency: { window: 7, thresholdPct: -2, upgradeCount: 2 },
    hysteresis: { stressOrCrisisDowngradeValidDays: 3, watchDowngradeValidDays: 2 },
    durationCanTriggerCrisisAlone: true,
    ewmaCanTriggerCrisisAlone: true,
    varCanTriggerCrisisAlone: true
  },
  {
    id: 'less_aggressive_crisis_v0_2_candidate',
    label: 'Less aggressive crisis thresholds',
    description: 'Raises crisis thresholds while keeping duration as an independent signal.',
    thresholds: {
      drawdownPct: { watch: -20, stress: -40, crisis: -60 },
      ewmaVolPct: { watch: 4.25, stress: 6.00, crisis: 8.00 },
      historicalVaRLossPct: { watch: 6.00, stress: 10.00, crisis: 12.00 },
      dailyReturnPct: { watch: -2, stress: -5, crisis: -10 },
      underwaterDurationDays: { watch: 14, stress: 21, crisis: 35 }
    },
    tailFrequency: { window: 7, thresholdPct: -2, upgradeCount: 2 },
    hysteresis: { stressOrCrisisDowngradeValidDays: 3, watchDowngradeValidDays: 2 },
    durationCanTriggerCrisisAlone: true,
    ewmaCanTriggerCrisisAlone: true,
    varCanTriggerCrisisAlone: true
  },
  {
    id: 'confirmation_based_v0_2_recommended',
    label: 'Confirmation-based thresholds',
    description: 'Drawdown remains primary; duration/EWMA confirm but do not dominate crisis alone.',
    thresholds: {
      drawdownPct: { watch: -20, stress: -40, crisis: -60 },
      ewmaVolPct: { watch: 4.25, stress: 6.00, crisis: 8.00 },
      historicalVaRLossPct: { watch: 6.00, stress: 10.00, crisis: 12.00 },
      dailyReturnPct: { watch: -2, stress: -5, crisis: -10 },
      underwaterDurationDays: { watch: 14, stress: 21, crisis: 35 }
    },
    tailFrequency: { window: 7, thresholdPct: -2, upgradeCount: 2 },
    hysteresis: { stressOrCrisisDowngradeValidDays: 3, watchDowngradeValidDays: 2 },
    durationCanTriggerCrisisAlone: false,
    ewmaCanTriggerCrisisAlone: false,
    varCanTriggerCrisisAlone: true
  }
];

const STATES = ['normal', 'watch', 'stress', 'crisis'];
const RANK = Object.fromEntries(STATES.map((s, i) => [s, i]));
const OUTPUT_DIR_CALIBRATION = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring_calibration');
const OUTPUT_CONFIGS_JSON = path.join(OUTPUT_DIR_CALIBRATION, 'threshold_sets.json');
const OUTPUT_SUMMARY_CSV = path.join(OUTPUT_DIR_CALIBRATION, 'calibration_summary.csv');
const OUTPUT_SUMMARY_JSON = path.join(OUTPUT_DIR_CALIBRATION, 'calibration_summary.json');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_DIR_CALIBRATION, 'yearly_comparison.csv');
const OUTPUT_TRANSITIONS_CSV = path.join(OUTPUT_DIR_CALIBRATION, 'transition_comparison.csv');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR_CALIBRATION, 'findings.md');

const SUMMARY_COLUMNS = [
  'configId',
  'label',
  'normalDays',
  'watchDays',
  'stressDays',
  'crisisDays',
  'stressOrCrisisDays',
  'stressOrCrisisPct',
  'crisisPct',
  'transitionCount',
  'longStressEpisodeCount',
  'longCrisisEpisodeCount',
  'maxStressEpisodeDays',
  'maxCrisisEpisodeDays',
  'stressDrawdownLeadPct',
  'bullRecoveryCrisisPct',
  'recommended'
];

const YEARLY_COLUMNS = [
  'configId',
  'year',
  'regime',
  'normalDays',
  'watchDays',
  'stressDays',
  'crisisDays',
  'stressOrCrisisPct',
  'crisisPct',
  'transitionCount',
  'maxStressEpisodeDays',
  'maxCrisisEpisodeDays',
  'stressDrawdownLeadPct',
  'maxDrawdownPct',
  'maxVarLossPct',
  'maxEwmaPct'
];

const TRANSITION_COLUMNS = [
  'configId',
  'state',
  'year',
  'regime',
  'startDate',
  'endDate',
  'durationDays',
  'maxDrawdownPct',
  'maxVarLossPct',
  'maxEwmaPct',
  'minDailyReturnPct'
];

function loadRows() {
  return YEARS.flatMap(item => {
    if (!fs.existsSync(item.input)) throw new Error(`Missing input ${item.input}`);
    const input = JSON.parse(fs.readFileSync(item.input, 'utf8'));
    return (input.rows || []).map(row => ({
      ...row,
      year: item.year,
      regime: item.regime
    }));
  }).sort((a, b) => `${a.year}-${a.date}-${a.cycle_id}`.localeCompare(`${b.year}-${b.date}-${b.cycle_id}`));
}

function severity(value, thresholds, direction) {
  if (value === null) return 'normal';
  if (direction === 'lte') {
    if (value <= thresholds.crisis) return 'crisis';
    if (value <= thresholds.stress) return 'stress';
    if (value <= thresholds.watch) return 'watch';
    return 'normal';
  }
  if (value >= thresholds.crisis) return 'crisis';
  if (value >= thresholds.stress) return 'stress';
  if (value >= thresholds.watch) return 'watch';
  return 'normal';
}

function maxState(states) {
  return states.reduce((max, state) => RANK[state] > RANK[max] ? state : max, 'normal');
}

function upgrade(state) {
  return STATES[Math.min(RANK[state] + 1, RANK.crisis)];
}

function stepDown(state) {
  return STATES[Math.max(RANK[state] - 1, 0)];
}

function buildSignals(rows, config) {
  const signals = [];
  let underwaterDuration = 0;
  const recentReturns = [];

  for (const row of rows) {
    const value = optionalNumber(row.approximate_CCW_value);
    const dailyReturnPct = optionalNumber(row.daily_return_pct);
    const drawdownPct = optionalNumber(row.rolling_drawdown_pct);
    const ewmaPct = optionalNumber(row.EWMA_vol_pct);
    const varPct = optionalNumber(row.historical_VaR_pct);
    const varLossPct = varPct === null ? null : Math.abs(Math.min(0, varPct));
    const mtmValid = value !== null;

    if (mtmValid && drawdownPct !== null && drawdownPct < 0) underwaterDuration += 1;
    else if (mtmValid) underwaterDuration = 0;

    if (dailyReturnPct !== null) {
      recentReturns.push(dailyReturnPct);
      if (recentReturns.length > config.tailFrequency.window) recentReturns.shift();
    }

    const recentTailLossDays = recentReturns.filter(v => v <= config.tailFrequency.thresholdPct).length;
    let drawdownState = severity(drawdownPct, config.thresholds.drawdownPct, 'lte');
    let varState = severity(varLossPct, config.thresholds.historicalVaRLossPct, 'gte');
    let ewmaState = severity(ewmaPct, config.thresholds.ewmaVolPct, 'gte');
    const tailState = severity(dailyReturnPct, config.thresholds.dailyReturnPct, 'lte');
    let durationState = severity(underwaterDuration, config.thresholds.underwaterDurationDays, 'gte');

    if (!config.durationCanTriggerCrisisAlone && durationState === 'crisis') durationState = 'stress';
    if (!config.ewmaCanTriggerCrisisAlone && ewmaState === 'crisis') ewmaState = 'stress';
    if (!config.varCanTriggerCrisisAlone && varState === 'crisis') varState = 'stress';

    let rawState = maxState([drawdownState, varState, ewmaState, tailState, durationState]);
    const reasons = [];

    if (RANK[drawdownState] > 0 && RANK[varState] > 0) {
      rawState = upgrade(rawState);
      reasons.push('drawdown_and_var');
    }
    if (RANK[drawdownState] > 0 && RANK[durationState] > 0) {
      rawState = upgrade(rawState);
      reasons.push('drawdown_and_duration');
    }
    if (recentTailLossDays >= config.tailFrequency.upgradeCount) {
      rawState = upgrade(rawState);
      reasons.push('tail_cluster');
    }

    signals.push({
      configId: config.id,
      date: row.date,
      year: row.year,
      regime: row.regime,
      mtmValid,
      dailyReturnPct,
      drawdownPct,
      ewmaPct,
      varLossPct,
      underwaterDuration: mtmValid ? underwaterDuration : null,
      recentTailLossDays,
      drawdownState,
      varState,
      ewmaState,
      tailState,
      durationState,
      rawState,
      finalState: null,
      reasons: reasons.join('; ')
    });
  }

  return applyHysteresis(signals, config);
}

function applyHysteresis(signals, config) {
  let currentState = 'normal';
  let belowCurrentValidDays = 0;

  return signals.map(signal => {
    if (!signal.mtmValid) {
      return { ...signal, finalState: currentState, hysteresisHold: true };
    }

    const rawRank = RANK[signal.rawState];
    const currentRank = RANK[currentState];
    if (rawRank > currentRank) {
      currentState = signal.rawState;
      belowCurrentValidDays = 0;
      return { ...signal, finalState: currentState, hysteresisHold: false };
    }
    if (rawRank === currentRank) {
      belowCurrentValidDays = 0;
      return { ...signal, finalState: currentState, hysteresisHold: false };
    }

    belowCurrentValidDays += 1;
    const required = currentState === 'watch'
      ? config.hysteresis.watchDowngradeValidDays
      : config.hysteresis.stressOrCrisisDowngradeValidDays;
    if (belowCurrentValidDays >= required && rawRank < RANK.stress) {
      currentState = currentState === 'watch' ? signal.rawState : stepDown(currentState);
      belowCurrentValidDays = 0;
      if (RANK[currentState] < rawRank) currentState = signal.rawState;
    }
    return { ...signal, finalState: currentState, hysteresisHold: RANK[currentState] > rawRank };
  });
}

function transitions(signals) {
  const out = [];
  let current = null;
  for (const signal of signals) {
    if (!current || current.state !== signal.finalState || current.year !== signal.year) {
      if (current) out.push(current);
      current = {
        configId: signal.configId,
        state: signal.finalState,
        year: signal.year,
        regime: signal.regime,
        startDate: signal.date,
        endDate: signal.date,
        durationDays: 1,
        maxDrawdownPct: signal.drawdownPct,
        maxVarLossPct: signal.varLossPct,
        maxEwmaPct: signal.ewmaPct,
        minDailyReturnPct: signal.dailyReturnPct
      };
      continue;
    }
    current.endDate = signal.date;
    current.durationDays += 1;
    current.maxDrawdownPct = minNullable(current.maxDrawdownPct, signal.drawdownPct);
    current.maxVarLossPct = maxNullable(current.maxVarLossPct, signal.varLossPct);
    current.maxEwmaPct = maxNullable(current.maxEwmaPct, signal.ewmaPct);
    current.minDailyReturnPct = minNullable(current.minDailyReturnPct, signal.dailyReturnPct);
  }
  if (current) out.push(current);
  return out.map(row => ({
    ...row,
    maxDrawdownPct: roundNumber(row.maxDrawdownPct),
    maxVarLossPct: roundNumber(row.maxVarLossPct),
    maxEwmaPct: roundNumber(row.maxEwmaPct),
    minDailyReturnPct: roundNumber(row.minDailyReturnPct)
  }));
}

function minNullable(a, b) {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.min(a, b);
}

function maxNullable(a, b) {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.max(a, b);
}

function yearlySummary(signals, trans) {
  return YEARS.map(item => {
    const rows = signals.filter(s => s.year === item.year);
    const yearTransitions = trans.filter(t => t.year === item.year);
    const counts = Object.fromEntries(STATES.map(state => [state, rows.filter(s => s.finalState === state).length]));
    const stressOrCrisis = counts.stress + counts.crisis;
    const stressDrawdownRows = rows.filter(s => s.drawdownPct !== null && s.drawdownPct <= -35);
    const leadRows = stressDrawdownRows.filter(row => {
      const prior = rows.filter(s => s.date < row.date).slice(-7);
      return prior.some(s => RANK[s.finalState] >= RANK.watch);
    });

    return {
      configId: rows[0] ? rows[0].configId : null,
      year: item.year,
      regime: item.regime,
      normalDays: counts.normal,
      watchDays: counts.watch,
      stressDays: counts.stress,
      crisisDays: counts.crisis,
      stressOrCrisisPct: roundNumber(stressOrCrisis / Math.max(rows.length, 1) * 100),
      crisisPct: roundNumber(counts.crisis / Math.max(rows.length, 1) * 100),
      transitionCount: yearTransitions.length,
      maxStressEpisodeDays: maxDuration(yearTransitions, 'stress'),
      maxCrisisEpisodeDays: maxDuration(yearTransitions, 'crisis'),
      stressDrawdownLeadPct: roundNumber(leadRows.length / Math.max(stressDrawdownRows.length, 1) * 100),
      maxDrawdownPct: roundNumber(Math.min(...rows.map(s => s.drawdownPct).filter(Number.isFinite))),
      maxVarLossPct: roundNumber(Math.max(...rows.map(s => s.varLossPct).filter(Number.isFinite))),
      maxEwmaPct: roundNumber(Math.max(...rows.map(s => s.ewmaPct).filter(Number.isFinite)))
    };
  });
}

function maxDuration(trans, state) {
  const rows = trans.filter(t => t.state === state);
  return rows.length ? Math.max(...rows.map(t => t.durationDays)) : 0;
}

function configSummary(config, signals, trans, yearly) {
  const counts = Object.fromEntries(STATES.map(state => [state, signals.filter(s => s.finalState === state).length]));
  const stressOrCrisis = counts.stress + counts.crisis;
  const stressDrawdownRows = signals.filter(s => s.drawdownPct !== null && s.drawdownPct <= -35);
  const leadRows = stressDrawdownRows.filter(row => {
    const prior = signals.filter(s => s.year === row.year && s.date < row.date).slice(-7);
    return prior.some(s => RANK[s.finalState] >= RANK.watch);
  });
  const longStress = trans.filter(t => t.state === 'stress' && t.durationDays >= 14);
  const longCrisis = trans.filter(t => t.state === 'crisis' && t.durationDays >= 14);
  const bullRecovery = yearly.filter(row => ['Bull market', 'Recovery', 'ETF/Bull'].includes(row.regime));
  const bullRecoveryDays = bullRecovery.reduce((sum, row) => sum + row.normalDays + row.watchDays + row.stressDays + row.crisisDays, 0);
  const bullRecoveryCrisisDays = bullRecovery.reduce((sum, row) => sum + row.crisisDays, 0);

  return {
    configId: config.id,
    label: config.label,
    normalDays: counts.normal,
    watchDays: counts.watch,
    stressDays: counts.stress,
    crisisDays: counts.crisis,
    stressOrCrisisDays: stressOrCrisis,
    stressOrCrisisPct: roundNumber(stressOrCrisis / Math.max(signals.length, 1) * 100),
    crisisPct: roundNumber(counts.crisis / Math.max(signals.length, 1) * 100),
    transitionCount: trans.length,
    longStressEpisodeCount: longStress.length,
    longCrisisEpisodeCount: longCrisis.length,
    maxStressEpisodeDays: maxDuration(trans, 'stress'),
    maxCrisisEpisodeDays: maxDuration(trans, 'crisis'),
    stressDrawdownLeadPct: roundNumber(leadRows.length / Math.max(stressDrawdownRows.length, 1) * 100),
    bullRecoveryCrisisPct: roundNumber(bullRecoveryCrisisDays / Math.max(bullRecoveryDays, 1) * 100),
    recommended: config.id === 'confirmation_based_v0_2_recommended'
  };
}

function buildMarkdown(summaries, yearly, recommendation) {
  return [
    '# Passive Hedge Monitoring Threshold Calibration',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Inputs: existing BTC Weekly OTM05 Daily MTM artifacts, 2020-2025.',
    '- No hedge execution.',
    '- No Daily MTM regeneration.',
    '- Goal: reduce over-alerting while preserving early warning before large drawdowns.',
    '',
    '## Configuration Comparison',
    '',
    markdownTable(summaries, ['configId', 'normalDays', 'watchDays', 'stressDays', 'crisisDays', 'stressOrCrisisPct', 'crisisPct', 'transitionCount', 'maxStressEpisodeDays', 'maxCrisisEpisodeDays', 'stressDrawdownLeadPct', 'bullRecoveryCrisisPct', 'recommended']),
    '',
    '## Recommendation',
    '',
    `Recommended threshold set: ${recommendation.configId}.`,
    '',
    '- Rationale: it reduces crisis dominance, prevents underwater duration from forcing crisis alone, and keeps large drawdowns preceded by watch/stress signals.',
    '- Drawdown remains the primary risk signal.',
    '- VaR confirms stress and tail persistence.',
    '- EWMA remains useful context/sizing, but not a standalone crisis driver.',
    '',
    '## Key Findings',
    '',
    '- Current thresholds over-alert: stress/crisis occupies too much of the sample.',
    '- Less aggressive crisis thresholds help, but duration can still dominate.',
    '- Confirmation-based thresholds provide the cleanest v0.2 candidate because crisis requires more severe price/risk evidence.',
    '- Bull and recovery regimes still produce alerts, which is expected for BTC, but crisis no longer dominates solely because the strategy remains underwater.',
    '',
    '## v0.2 Proposed Threshold Behavior',
    '',
    '- Drawdown: watch -20%, stress -40%, crisis -60%.',
    '- VaR loss: watch 6%, stress 10%, crisis 12%.',
    '- EWMA: watch 4.25%, stress 6%, crisis 8%.',
    '- Underwater duration: watch 14d, stress 21d, crisis 35d, but duration cannot trigger crisis alone.',
    '',
    '## Next Checks Before Hedge Simulation',
    '',
    '- Inspect state transitions around 2020 crash, 2021 drawdowns, and 2022 bear market.',
    '- Test whether stress is early enough without keeping the system permanently escalated.',
    '- Consider requiring drawdown plus VaR confirmation for any future hedge action.',
    '- Keep this as monitoring only until funding, basis, custody, slippage, and hedge latency are modeled.',
    '',
    '## Yearly Details',
    '',
    markdownTable(yearly.filter(row => row.configId === recommendation.configId), ['year', 'regime', 'normalDays', 'watchDays', 'stressDays', 'crisisDays', 'stressOrCrisisPct', 'crisisPct', 'transitionCount', 'maxStressEpisodeDays', 'maxCrisisEpisodeDays', 'stressDrawdownLeadPct']),
    ''
  ].join('\n');
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function assertNoOverwrite() {
  const outputs = [OUTPUT_CONFIGS_JSON, OUTPUT_SUMMARY_CSV, OUTPUT_SUMMARY_JSON, OUTPUT_YEARLY_CSV, OUTPUT_TRANSITIONS_CSV, OUTPUT_FINDINGS_MD];
  const existing = outputs.filter(file => fs.existsSync(file));
  if (existing.length) {
    throw new Error(`Refusing to overwrite calibration outputs: ${existing.map(file => path.relative(REPO_ROOT, file)).join(', ')}`);
  }
}

function main() {
  assertNoOverwrite();
  const rows = loadRows();
  const allYearly = [];
  const allTransitions = [];
  const summaries = [];

  for (const config of CONFIGS) {
    const signals = buildSignals(rows, config);
    const trans = transitions(signals);
    const y = yearlySummary(signals, trans);
    summaries.push(configSummary(config, signals, trans, y));
    allYearly.push(...y);
    allTransitions.push(...trans);
  }

  const recommendation = summaries.find(row => row.recommended);
  fs.mkdirSync(OUTPUT_DIR_CALIBRATION, { recursive: true });
  fs.writeFileSync(OUTPUT_CONFIGS_JSON, `${JSON.stringify(CONFIGS, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SUMMARY_CSV, `${objectsToCsv(summaries, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SUMMARY_JSON, `${JSON.stringify({ generatedAt: new Date().toISOString(), recommendation, summaries, yearly: allYearly }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(allYearly, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_TRANSITIONS_CSV, `${objectsToCsv(allTransitions, TRANSITION_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildMarkdown(summaries, allYearly, recommendation), 'utf8');

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CONFIGS_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SUMMARY_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SUMMARY_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_YEARLY_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_TRANSITIONS_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FINDINGS_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error calibrating passive hedge monitoring:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CONFIGS,
  buildSignals,
  transitions,
  yearlySummary,
  configSummary
};
