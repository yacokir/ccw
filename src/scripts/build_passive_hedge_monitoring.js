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

const THRESHOLDS = {
  generatedFor: 'BTC Weekly OTM05 Daily MTM 2020-2025',
  status: 'preliminary research thresholds; not hedge execution rules',
  thresholds: {
    drawdownPct: { watch: -20, stress: -35, crisis: -50 },
    ewmaVolPct: { watch: 4.25, stress: 6.00, crisis: 7.50 },
    historicalVaRLossPct: { watch: 6.00, stress: 10.00, crisis: 11.50 },
    dailyReturnPct: { watch: -2, stress: -5, crisis: -10 },
    underwaterDurationDays: { watch: 14, stress: 21, crisis: 28 }
  },
  tailFrequency: {
    recentWindowValidReturnDays: 7,
    tailLossThresholdPct: -2,
    upgradeCount: 2
  },
  hysteresis: {
    stressOrCrisisDowngradeValidDays: 3,
    watchDowngradeValidDays: 2,
    downgradeOnlyWhenRawSeverityIsBelowCurrent: true,
    downgradeBlockedByStressOrCrisisRawSignal: true
  },
  dataQuality: {
    dataGapWhenMtmMissing: true,
    partialSignalWhenMtmPresentButDailyReturnMissing: true
  }
};

const OUTPUT_DIR_MONITOR = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_monitoring');
const OUTPUT_SIGNALS_CSV = path.join(OUTPUT_DIR_MONITOR, 'signals_daily.csv');
const OUTPUT_SIGNALS_JSON = path.join(OUTPUT_DIR_MONITOR, 'signals_daily.json');
const OUTPUT_TRANSITIONS_CSV = path.join(OUTPUT_DIR_MONITOR, 'state_transitions.csv');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_DIR_MONITOR, 'yearly_alert_summary.csv');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR_MONITOR, 'findings.md');
const OUTPUT_THRESHOLD_JSON = path.join(OUTPUT_DIR_MONITOR, 'threshold_config.json');

const STATES = ['normal', 'watch', 'stress', 'crisis'];
const STATE_RANK = Object.fromEntries(STATES.map((state, index) => [state, index]));

const SIGNAL_COLUMNS = [
  'date',
  'year',
  'regime',
  'cycle_id',
  'mtm_valid',
  'data_quality_state',
  'approximate_CCW_value',
  'daily_return_pct',
  'rolling_drawdown_pct',
  'EWMA_vol_pct',
  'historical_VaR_loss_pct',
  'underwater_duration_days',
  'recent_tail_loss_days',
  'drawdown_state',
  'var_state',
  'ewma_state',
  'tail_state',
  'duration_state',
  'raw_state',
  'final_state',
  'hysteresis_hold',
  'upgrade_reasons',
  'notes'
];

const TRANSITION_COLUMNS = [
  'start_date',
  'end_date',
  'year',
  'regime',
  'state',
  'duration_days',
  'max_drawdown_pct',
  'max_ewma_pct',
  'max_var_loss_pct',
  'min_daily_return_pct',
  'tail_loss_days'
];

const YEARLY_COLUMNS = [
  'year',
  'regime',
  'totalRows',
  'validMtmRows',
  'normalDays',
  'watchDays',
  'stressDays',
  'crisisDays',
  'stressOrCrisisDays',
  'pctStressOrCrisis',
  'transitionCount',
  'stressEpisodeCount',
  'crisisEpisodeCount',
  'maxStressEpisodeDays',
  'maxCrisisEpisodeDays',
  'medianStressEpisodeDays',
  'firstStressDate',
  'firstCrisisDate',
  'maxDrawdownPct',
  'worstDailyReturnPct',
  'maxEwmaPct',
  'maxVarLossPct',
  'dataGapRows',
  'partialSignalRows'
];

function stateMax(...states) {
  return states.reduce((maxState, state) => (
    STATE_RANK[state] > STATE_RANK[maxState] ? state : maxState
  ), 'normal');
}

function stateStepDown(state) {
  const rank = Math.max(STATE_RANK[state] - 1, 0);
  return STATES[rank];
}

function severityAtLeast(value, thresholds, direction) {
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

function stateUpgrade(state) {
  return STATES[Math.min(STATE_RANK[state] + 1, STATE_RANK.crisis)];
}

function dateKey(row) {
  return `${row.year}-${row.date}-${String(row.cycle_id).padStart(3, '0')}`;
}

function loadAnnualRows(item) {
  if (!fs.existsSync(item.input)) {
    throw new Error(`Missing Daily MTM input: ${path.relative(REPO_ROOT, item.input)}`);
  }
  const input = JSON.parse(fs.readFileSync(item.input, 'utf8'));
  return (input.rows || []).map(row => ({
    ...row,
    year: item.year,
    regime: item.regime,
    source: path.relative(REPO_ROOT, item.input)
  }));
}

function buildRawSignals(rows) {
  const signals = [];
  const recentReturns = [];
  let underwaterDuration = 0;

  for (const row of rows.sort((a, b) => dateKey(a).localeCompare(dateKey(b)))) {
    const value = optionalNumber(row.approximate_CCW_value);
    const dailyReturnPct = optionalNumber(row.daily_return_pct);
    const drawdownPct = optionalNumber(row.rolling_drawdown_pct);
    const ewmaPct = optionalNumber(row.EWMA_vol_pct);
    const varPct = optionalNumber(row.historical_VaR_pct);
    const varLossPct = varPct === null ? null : Math.abs(Math.min(0, varPct));
    const mtmValid = value !== null;

    if (mtmValid && drawdownPct !== null && drawdownPct < 0) {
      underwaterDuration += 1;
    } else if (mtmValid) {
      underwaterDuration = 0;
    }

    if (dailyReturnPct !== null) {
      recentReturns.push(dailyReturnPct);
      if (recentReturns.length > THRESHOLDS.tailFrequency.recentWindowValidReturnDays) {
        recentReturns.shift();
      }
    }

    const recentTailLossDays = recentReturns.filter(v => v <= THRESHOLDS.tailFrequency.tailLossThresholdPct).length;
    const drawdownState = severityAtLeast(drawdownPct, THRESHOLDS.thresholds.drawdownPct, 'lte');
    const varState = severityAtLeast(varLossPct, THRESHOLDS.thresholds.historicalVaRLossPct, 'gte');
    const ewmaState = severityAtLeast(ewmaPct, THRESHOLDS.thresholds.ewmaVolPct, 'gte');
    const tailState = severityAtLeast(dailyReturnPct, THRESHOLDS.thresholds.dailyReturnPct, 'lte');
    const durationState = severityAtLeast(underwaterDuration, THRESHOLDS.thresholds.underwaterDurationDays, 'gte');
    let rawState = stateMax(drawdownState, varState, ewmaState, tailState, durationState);
    const upgradeReasons = [];

    if (STATE_RANK[drawdownState] > 0 && STATE_RANK[varState] > 0) {
      rawState = stateUpgrade(rawState);
      upgradeReasons.push('drawdown_and_var_active');
    }
    if (STATE_RANK[drawdownState] > 0 && STATE_RANK[durationState] > 0) {
      rawState = stateUpgrade(rawState);
      upgradeReasons.push('drawdown_and_underwater_duration_active');
    }
    if (recentTailLossDays >= THRESHOLDS.tailFrequency.upgradeCount) {
      rawState = stateUpgrade(rawState);
      upgradeReasons.push(`recent_tail_loss_days_gte_${THRESHOLDS.tailFrequency.upgradeCount}`);
    }

    const dataQualityState = !mtmValid
      ? 'data_gap'
      : dailyReturnPct === null
        ? 'partial_signal'
        : 'valid_signal';

    signals.push({
      date: row.date,
      year: row.year,
      regime: row.regime,
      cycle_id: row.cycle_id,
      mtm_valid: mtmValid,
      data_quality_state: dataQualityState,
      approximate_CCW_value: value,
      daily_return_pct: dailyReturnPct,
      rolling_drawdown_pct: drawdownPct,
      EWMA_vol_pct: ewmaPct,
      historical_VaR_loss_pct: varLossPct,
      underwater_duration_days: mtmValid ? underwaterDuration : null,
      recent_tail_loss_days: recentTailLossDays,
      drawdown_state: drawdownState,
      var_state: varState,
      ewma_state: ewmaState,
      tail_state: tailState,
      duration_state: durationState,
      raw_state: rawState,
      final_state: null,
      hysteresis_hold: false,
      upgrade_reasons: upgradeReasons.join('; '),
      notes: row.notes || ''
    });
  }

  return signals;
}

function applyHysteresis(signals) {
  let currentState = 'normal';
  let belowCurrentValidDays = 0;

  return signals.map(signal => {
    if (!signal.mtm_valid) {
      return {
        ...signal,
        final_state: currentState,
        hysteresis_hold: true
      };
    }

    const rawRank = STATE_RANK[signal.raw_state];
    const currentRank = STATE_RANK[currentState];

    if (rawRank > currentRank) {
      currentState = signal.raw_state;
      belowCurrentValidDays = 0;
      return {
        ...signal,
        final_state: currentState,
        hysteresis_hold: false
      };
    }

    if (rawRank === currentRank) {
      belowCurrentValidDays = 0;
      return {
        ...signal,
        final_state: currentState,
        hysteresis_hold: false
      };
    }

    belowCurrentValidDays += 1;
    const requiredDays = currentState === 'watch'
      ? THRESHOLDS.hysteresis.watchDowngradeValidDays
      : THRESHOLDS.hysteresis.stressOrCrisisDowngradeValidDays;
    const rawStressOrCrisis = rawRank >= STATE_RANK.stress;
    const canDowngrade = belowCurrentValidDays >= requiredDays && !rawStressOrCrisis;

    if (canDowngrade) {
      currentState = currentState === 'watch' ? signal.raw_state : stateStepDown(currentState);
      belowCurrentValidDays = 0;
      if (STATE_RANK[currentState] < rawRank) currentState = signal.raw_state;
    }

    return {
      ...signal,
      final_state: currentState,
      hysteresis_hold: STATE_RANK[currentState] > rawRank
    };
  });
}

function buildTransitions(signals) {
  const transitions = [];
  let current = null;

  function close(endSignal) {
    if (!current) return;
    current.end_date = endSignal.date;
    current.duration_days += 1;
    transitions.push(current);
    current = null;
  }

  for (const signal of signals) {
    if (!current || current.state !== signal.final_state || current.year !== signal.year) {
      if (current) transitions.push(current);
      current = {
        start_date: signal.date,
        end_date: signal.date,
        year: signal.year,
        regime: signal.regime,
        state: signal.final_state,
        duration_days: 1,
        max_drawdown_pct: signal.rolling_drawdown_pct,
        max_ewma_pct: signal.EWMA_vol_pct,
        max_var_loss_pct: signal.historical_VaR_loss_pct,
        min_daily_return_pct: signal.daily_return_pct,
        tail_loss_days: signal.daily_return_pct !== null && signal.daily_return_pct <= THRESHOLDS.tailFrequency.tailLossThresholdPct ? 1 : 0
      };
      continue;
    }

    current.end_date = signal.date;
    current.duration_days += 1;
    current.max_drawdown_pct = minNullable(current.max_drawdown_pct, signal.rolling_drawdown_pct);
    current.max_ewma_pct = maxNullable(current.max_ewma_pct, signal.EWMA_vol_pct);
    current.max_var_loss_pct = maxNullable(current.max_var_loss_pct, signal.historical_VaR_loss_pct);
    current.min_daily_return_pct = minNullable(current.min_daily_return_pct, signal.daily_return_pct);
    if (signal.daily_return_pct !== null && signal.daily_return_pct <= THRESHOLDS.tailFrequency.tailLossThresholdPct) {
      current.tail_loss_days += 1;
    }
  }
  if (current) transitions.push(current);
  return transitions.map(row => ({
    ...row,
    max_drawdown_pct: roundNumber(row.max_drawdown_pct),
    max_ewma_pct: roundNumber(row.max_ewma_pct),
    max_var_loss_pct: roundNumber(row.max_var_loss_pct),
    min_daily_return_pct: roundNumber(row.min_daily_return_pct)
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

function summarizeYearly(signals, transitions) {
  const years = [...new Set(signals.map(s => s.year))].sort((a, b) => a - b);
  return years.map(year => {
    const rows = signals.filter(s => s.year === year);
    const yearTransitions = transitions.filter(t => t.year === year);
    const stressEpisodes = yearTransitions.filter(t => t.state === 'stress');
    const crisisEpisodes = yearTransitions.filter(t => t.state === 'crisis');
    const validRows = rows.filter(s => s.mtm_valid);
    const counts = Object.fromEntries(STATES.map(state => [state, rows.filter(s => s.final_state === state).length]));
    const stressOrCrisisDays = counts.stress + counts.crisis;

    return {
      year,
      regime: rows[0] ? rows[0].regime : null,
      totalRows: rows.length,
      validMtmRows: validRows.length,
      normalDays: counts.normal,
      watchDays: counts.watch,
      stressDays: counts.stress,
      crisisDays: counts.crisis,
      stressOrCrisisDays,
      pctStressOrCrisis: roundNumber(stressOrCrisisDays / Math.max(rows.length, 1) * 100),
      transitionCount: yearTransitions.length,
      stressEpisodeCount: stressEpisodes.length,
      crisisEpisodeCount: crisisEpisodes.length,
      maxStressEpisodeDays: stressEpisodes.length ? Math.max(...stressEpisodes.map(t => t.duration_days)) : 0,
      maxCrisisEpisodeDays: crisisEpisodes.length ? Math.max(...crisisEpisodes.map(t => t.duration_days)) : 0,
      medianStressEpisodeDays: roundNumber(median(stressEpisodes.map(t => t.duration_days))),
      firstStressDate: (rows.find(s => s.final_state === 'stress') || {}).date || null,
      firstCrisisDate: (rows.find(s => s.final_state === 'crisis') || {}).date || null,
      maxDrawdownPct: roundNumber(Math.min(...validRows.map(s => s.rolling_drawdown_pct).filter(Number.isFinite))),
      worstDailyReturnPct: roundNumber(Math.min(...validRows.map(s => s.daily_return_pct).filter(Number.isFinite))),
      maxEwmaPct: roundNumber(Math.max(...validRows.map(s => s.EWMA_vol_pct).filter(Number.isFinite))),
      maxVarLossPct: roundNumber(Math.max(...validRows.map(s => s.historical_VaR_loss_pct).filter(Number.isFinite))),
      dataGapRows: rows.filter(s => s.data_quality_state === 'data_gap').length,
      partialSignalRows: rows.filter(s => s.data_quality_state === 'partial_signal').length
    };
  });
}

function signalSummary(signals, transitions, yearly) {
  const counts = Object.fromEntries(STATES.map(state => [state, signals.filter(s => s.final_state === state).length]));
  const rawCounts = Object.fromEntries(STATES.map(state => [state, signals.filter(s => s.raw_state === state).length]));
  const stressTransitions = transitions.filter(t => t.state === 'stress');
  const crisisTransitions = transitions.filter(t => t.state === 'crisis');
  const largeDrawdownRows = signals.filter(s => s.rolling_drawdown_pct !== null && s.rolling_drawdown_pct <= THRESHOLDS.thresholds.drawdownPct.stress);
  const largeDrawdownLeadRows = largeDrawdownRows.filter(row => {
    const prior = signals.filter(s => s.year === row.year && s.date < row.date).slice(-7);
    return prior.some(s => STATE_RANK[s.final_state] >= STATE_RANK.watch);
  });

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      strategy: 'BTC Weekly OTM05',
      years: YEARS.map(y => y.year),
      purpose: 'Passive hedge monitoring research layer',
      executionPolicy: 'No hedge execution; state classification only'
    },
    counts,
    rawCounts,
    totalRows: signals.length,
    validMtmRows: signals.filter(s => s.mtm_valid).length,
    dataQuality: {
      dataGapRows: signals.filter(s => s.data_quality_state === 'data_gap').length,
      partialSignalRows: signals.filter(s => s.data_quality_state === 'partial_signal').length,
      validSignalRows: signals.filter(s => s.data_quality_state === 'valid_signal').length
    },
    episodes: {
      totalTransitions: transitions.length,
      stressEpisodeCount: stressTransitions.length,
      crisisEpisodeCount: crisisTransitions.length,
      maxStressDurationDays: stressTransitions.length ? Math.max(...stressTransitions.map(t => t.duration_days)) : 0,
      maxCrisisDurationDays: crisisTransitions.length ? Math.max(...crisisTransitions.map(t => t.duration_days)) : 0,
      medianStressDurationDays: roundNumber(median(stressTransitions.map(t => t.duration_days))),
      medianCrisisDurationDays: roundNumber(median(crisisTransitions.map(t => t.duration_days)))
    },
    leadDrawdownEvidence: {
      stressDrawdownRows: largeDrawdownRows.length,
      stressDrawdownRowsWithPriorWatchOrWorse7Rows: largeDrawdownLeadRows.length,
      pctWithPriorWatchOrWorse7Rows: roundNumber(largeDrawdownLeadRows.length / Math.max(largeDrawdownRows.length, 1) * 100)
    },
    yearly,
    interpretation: interpret(signals, transitions, yearly)
  };
}

function interpret(signals, transitions, yearly) {
  const mostStress = yearly.slice().sort((a, b) => b.stressDays - a.stressDays)[0];
  const mostCrisis = yearly.slice().sort((a, b) => b.crisisDays - a.crisisDays)[0];
  const finalCounts = Object.fromEntries(STATES.map(state => [state, signals.filter(s => s.final_state === state).length]));
  const rawCounts = Object.fromEntries(STATES.map(state => [state, signals.filter(s => s.raw_state === state).length]));

  return {
    mostStressYear: mostStress ? mostStress.year : null,
    mostCrisisYear: mostCrisis ? mostCrisis.year : null,
    hysteresisReducedNoise: transitions.length < signals.filter((s, i) => i > 0 && s.raw_state !== signals[i - 1].raw_state).length,
    stressOrCrisisSharePct: roundNumber((finalCounts.stress + finalCounts.crisis) / Math.max(signals.length, 1) * 100),
    rawStressOrCrisisSharePct: roundNumber((rawCounts.stress + rawCounts.crisis) / Math.max(signals.length, 1) * 100),
    likelyFalsePositiveRisk: 'Moderate: 2020/2021 bull years still produce many stress/crisis alerts because upside regimes can contain violent intracycle drawdowns.',
    redundantSignals: [
      'drawdown and underwater duration are correlated but not identical; duration adds persistence.',
      'VaR and EWMA overlap as stress indicators, but VaR captures loss persistence more directly.',
      'daily return threshold is noisy alone and is best used as a tail-frequency input.'
    ],
    mostUsefulFutureHedgeSignals: [
      'drawdown state',
      'VaR loss state',
      'underwater duration',
      'recent tail-loss frequency',
      'EWMA as sizing/context signal'
    ],
    obviousAdjustments: [
      'Require confirmation before acting on watch alerts.',
      'Use drawdown plus VaR or drawdown plus duration for stress escalation.',
      'Consider asset/regime-specific calibration before live hedge simulation.',
      'Keep crisis thresholds conservative until funding, basis, slippage, and hedge latency are modeled.'
    ]
  };
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildMarkdown(summary) {
  const yearlyRows = summary.yearly.map(row => ({
    year: row.year,
    regime: row.regime,
    normal: row.normalDays,
    watch: row.watchDays,
    stress: row.stressDays,
    crisis: row.crisisDays,
    stressPct: `${row.pctStressOrCrisis}%`,
    maxStressEp: row.maxStressEpisodeDays,
    maxCrisisEp: row.maxCrisisEpisodeDays,
    firstStress: row.firstStressDate || '',
    firstCrisis: row.firstCrisisDate || ''
  }));

  return [
    '# Passive Hedge Monitoring Layer - BTC Weekly OTM05',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Scope',
    '',
    '- Inputs: existing BTC Weekly OTM05 Daily MTM artifacts, 2020-2025.',
    '- Purpose: answer "what risk state is the strategy in today?"',
    '- Explicit non-goal: decide or execute a hedge.',
    '- Thresholds are preliminary research thresholds, not production rules.',
    '',
    '## State Counts',
    '',
    `- Normal: ${summary.counts.normal}`,
    `- Watch: ${summary.counts.watch}`,
    `- Stress: ${summary.counts.stress}`,
    `- Crisis: ${summary.counts.crisis}`,
    `- Stress or crisis share: ${summary.interpretation.stressOrCrisisSharePct}%`,
    '',
    '## Yearly Alert Summary',
    '',
    markdownTable(yearlyRows, ['year', 'regime', 'normal', 'watch', 'stress', 'crisis', 'stressPct', 'maxStressEp', 'maxCrisisEp', 'firstStress', 'firstCrisis']),
    '',
    '## Questions',
    '',
    `1. Days by state: normal ${summary.counts.normal}, watch ${summary.counts.watch}, stress ${summary.counts.stress}, crisis ${summary.counts.crisis}.`,
    `2. Most stress days: ${summary.interpretation.mostStressYear}. Most crisis days: ${summary.interpretation.mostCrisisYear}.`,
    `3. Longest stress episode: ${summary.episodes.maxStressDurationDays} days. Longest crisis episode: ${summary.episodes.maxCrisisDurationDays} days.`,
    `4. Alerts before large drawdowns: ${summary.leadDrawdownEvidence.pctWithPriorWatchOrWorse7Rows}% of stress-drawdown rows had a prior watch-or-worse signal in the previous 7 valid rows.`,
    `5. Threshold reasonableness: ${summary.interpretation.likelyFalsePositiveRisk}`,
    '6. Redundancy:',
    ...summary.interpretation.redundantSignals.map(item => `   - ${item}`),
    '7. Most useful future hedge signals:',
    ...summary.interpretation.mostUsefulFutureHedgeSignals.map(item => `   - ${item}`),
    `8. Hysteresis reduced noise: ${summary.interpretation.hysteresisReducedNoise ? 'yes' : 'not clearly'}. Raw stress/crisis share ${summary.interpretation.rawStressOrCrisisSharePct}% vs final ${summary.interpretation.stressOrCrisisSharePct}%.`,
    '9. Obvious adjustments before hedge simulation:',
    ...summary.interpretation.obviousAdjustments.map(item => `   - ${item}`),
    '',
    '## Recommendations',
    '',
    '- Keep this as a passive monitoring layer first.',
    '- Use drawdown as the primary state signal.',
    '- Use VaR and underwater duration as confirmation signals.',
    '- Use EWMA as sizing/context for future hedge research, not as the sole trigger.',
    '- Treat daily-return shocks as noisy unless they cluster.',
    '- Do not bridge Daily MTM data gaps in future hedge simulations.',
    '',
    '## Limitations',
    '',
    '- Approximate MTM only; no official option marks or greeks.',
    '- No funding, basis, slippage, custody, margin, liquidation, or hedge execution costs.',
    '- Thresholds are calibrated from BTC OTM05 2020-2025 and may not transfer to ETH or other strategies.',
    '- Hysteresis is intentionally simple and should be validated before any hedge simulation.',
    ''
  ].join('\n');
}

function assertNoOverwrite() {
  const outputs = [
    OUTPUT_SIGNALS_CSV,
    OUTPUT_SIGNALS_JSON,
    OUTPUT_TRANSITIONS_CSV,
    OUTPUT_YEARLY_CSV,
    OUTPUT_FINDINGS_MD,
    OUTPUT_THRESHOLD_JSON
  ];
  const existing = outputs.filter(filePath => fs.existsSync(filePath));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing hedge monitoring outputs: ${existing.map(filePath => path.relative(REPO_ROOT, filePath)).join(', ')}`);
  }
}

function roundSignal(signal) {
  const rounded = { ...signal };
  for (const key of Object.keys(rounded)) {
    if (typeof rounded[key] === 'number' && !Number.isInteger(rounded[key])) {
      rounded[key] = roundNumber(rounded[key]);
    }
  }
  return rounded;
}

function main() {
  assertNoOverwrite();
  const annualRows = YEARS.flatMap(loadAnnualRows);
  const rawSignals = YEARS.flatMap(item => buildRawSignals(loadAnnualRows(item)));
  const signals = applyHysteresis(rawSignals).map(roundSignal);
  const transitions = buildTransitions(signals);
  const yearly = summarizeYearly(signals, transitions);
  const summary = signalSummary(signals, transitions, yearly);

  fs.mkdirSync(OUTPUT_DIR_MONITOR, { recursive: true });
  fs.writeFileSync(OUTPUT_THRESHOLD_JSON, `${JSON.stringify(THRESHOLDS, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SIGNALS_CSV, `${objectsToCsv(signals, SIGNAL_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SIGNALS_JSON, `${JSON.stringify({ ...summary, thresholds: THRESHOLDS, signals }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_TRANSITIONS_CSV, `${objectsToCsv(transitions, TRANSITION_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(yearly, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildMarkdown(summary), 'utf8');

  console.log(`Read ${annualRows.length} Daily MTM rows.`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SIGNALS_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SIGNALS_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_TRANSITIONS_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_YEARLY_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FINDINGS_MD)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_THRESHOLD_JSON)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building passive hedge monitoring layer:', error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  THRESHOLDS,
  buildRawSignals,
  applyHysteresis,
  buildTransitions,
  summarizeYearly
};
