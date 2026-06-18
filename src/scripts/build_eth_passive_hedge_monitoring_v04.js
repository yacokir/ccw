const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  objectsToCsv,
  optionalNumber,
  roundNumber
} = require('./btc_deep_risk_utils');

const INPUTS = [
  {
    year: 2025,
    regime: 'Mixed',
    input: path.join(OUTPUT_DIR, 'daily_mtm', 'eth_weekly_otm05_2025', 'eth_weekly_otm05_2025_daily_mtm.json')
  }
];

const THRESHOLDS = {
  drawdownPct: { watch: -20, stress: -40, crisis: -60 },
  ewmaVolPct: { watch: 4.25, stress: 6.00, crisis: 8.00 },
  historicalVaRLossPct: { watch: 6.00, stress: 10.00, crisis: 12.00 },
  dailyReturnPct: { watch: -2, stress: -5, crisis: -10 },
  underwaterDurationDays: { watch: 14, stress: 21 }
};

const CONFIGS = [
  {
    id: 'v04a_confirmation_stress',
    label: 'v0.4a confirmation stress',
    stressRule: 'drawdown_watch_plus_any_risk_signal'
  },
  {
    id: 'v04b_actionable_stress_recommended',
    label: 'v0.4b actionable stress',
    stressRule: 'drawdown_stress_or_drawdown_watch_plus_var_tail'
  },
  {
    id: 'v04c_regime_stress',
    label: 'v0.4c regime stress',
    stressRule: 'var_watch_plus_ewma_watch_with_drawdown_watch'
  }
];

const STATES = ['normal', 'watch', 'stress', 'crisis'];
const RANK = Object.fromEntries(STATES.map((s, i) => [s, i]));
const TAIL_WINDOW = 7;
const TAIL_CLUSTER_COUNT = 2;
const TAIL_CLUSTER_THRESHOLD = -2;

const OUTPUT_DIR_V04 = path.join(OUTPUT_DIR, 'daily_mtm', 'eth_hedge_monitoring_calibration_v04');
const OUTPUT_CONFIGS_JSON = path.join(OUTPUT_DIR_V04, 'threshold_sets_v04.json');
const OUTPUT_SUMMARY_CSV = path.join(OUTPUT_DIR_V04, 'calibration_v04_summary.csv');
const OUTPUT_SUMMARY_JSON = path.join(OUTPUT_DIR_V04, 'calibration_v04_summary.json');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_DIR_V04, 'yearly_v04_comparison.csv');
const OUTPUT_TRANSITIONS_CSV = path.join(OUTPUT_DIR_V04, 'transition_v04_comparison.csv');
const OUTPUT_SIGNALS_CSV = path.join(OUTPUT_DIR_V04, 'signals_v04_recommended.csv');
const OUTPUT_SIGNALS_JSON = path.join(OUTPUT_DIR_V04, 'signals_v04_recommended.json');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR_V04, 'findings.md');

const SUMMARY_COLUMNS = [
  'configId',
  'label',
  'normalDays',
  'watchDays',
  'stressDays',
  'crisisDays',
  'stressOrCrisisPct',
  'crisisPct',
  'damageStressOrCrisisPct',
  'transitionCount',
  'maxStressEpisodeDays',
  'maxCrisisEpisodeDays',
  'largeDrawdownLeadPct',
  'largeDrawdownFalseNegativePct',
  'stressYearsFalseNegativePct',
  'bullRecoveryStressOrCrisisPct',
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
  'damageStressOrCrisisPct',
  'transitionCount',
  'maxStressEpisodeDays',
  'maxCrisisEpisodeDays',
  'largeDrawdownLeadPct',
  'largeDrawdownFalseNegativePct',
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
  'maxDamageState',
  'maxDrawdownPct',
  'maxVarLossPct',
  'maxEwmaPct',
  'minDailyReturnPct'
];

const SIGNAL_COLUMNS = [
  'date',
  'year',
  'regime',
  'damage_state',
  'alert_state',
  'drawdown_state',
  'duration_state',
  'var_state',
  'ewma_state',
  'tail_state',
  'rolling_drawdown_pct',
  'historical_var_loss_pct',
  'ewma_vol_pct',
  'daily_return_pct',
  'underwater_duration_days',
  'recent_tail_loss_days',
  'alert_reason'
];

function loadRows() {
  return INPUTS.flatMap(item => {
    if (!fs.existsSync(item.input)) throw new Error(`Missing input ${item.input}`);
    const payload = JSON.parse(fs.readFileSync(item.input, 'utf8'));
    return (payload.rows || []).map(row => ({ ...row, year: item.year, regime: item.regime }));
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
  if (thresholds.crisis !== undefined && value >= thresholds.crisis) return 'crisis';
  if (value >= thresholds.stress) return 'stress';
  if (value >= thresholds.watch) return 'watch';
  return 'normal';
}

function maxState(states) {
  return states.reduce((max, state) => RANK[state] > RANK[max] ? state : max, 'normal');
}

function capState(state, cap) {
  return RANK[state] > RANK[cap] ? cap : state;
}

function buildSignals(rows, config) {
  let underwaterDuration = 0;
  const recentReturns = [];

  return rows.map(row => {
    const value = optionalNumber(row.approximate_CCW_value);
    const dailyReturnPct = optionalNumber(row.daily_return_pct);
    const drawdownPct = optionalNumber(row.rolling_drawdown_pct);
    const ewmaPct = optionalNumber(row.EWMA_vol_pct);
    const varPct = optionalNumber(row.historical_VaR_pct);
    const varLossPct = varPct === null ? null : Math.abs(Math.min(0, varPct));

    if (value !== null && drawdownPct !== null && drawdownPct < 0) underwaterDuration += 1;
    else if (value !== null) underwaterDuration = 0;

    if (dailyReturnPct !== null) {
      recentReturns.push(dailyReturnPct);
      if (recentReturns.length > TAIL_WINDOW) recentReturns.shift();
    }

    const recentTailLossDays = recentReturns.filter(v => v <= TAIL_CLUSTER_THRESHOLD).length;
    const drawdownState = severity(drawdownPct, THRESHOLDS.drawdownPct, 'lte');
    const durationState = capState(severity(underwaterDuration, THRESHOLDS.underwaterDurationDays, 'gte'), 'stress');
    const damageState = maxState([drawdownState, durationState]);
    const varState = severity(varLossPct, THRESHOLDS.historicalVaRLossPct, 'gte');
    const ewmaState = severity(ewmaPct, THRESHOLDS.ewmaVolPct, 'gte');
    const dailyTailState = severity(dailyReturnPct, THRESHOLDS.dailyReturnPct, 'lte');
    const clusterState = recentTailLossDays >= TAIL_CLUSTER_COUNT ? 'stress' : 'normal';
    const tailState = maxState([dailyTailState, clusterState]);

    const crisis = RANK[drawdownState] >= RANK.stress
      && RANK[varState] >= RANK.stress
      && recentTailLossDays >= TAIL_CLUSTER_COUNT;

    const stressReason = stressReasonFor(config, {
      drawdownState,
      durationState,
      varState,
      ewmaState,
      tailState,
      recentTailLossDays
    });

    let alertState = 'normal';
    let alertReason = '';
    if (RANK[damageState] >= RANK.watch) {
      alertState = 'watch';
      alertReason = 'damage_watch_context';
    }
    if (stressReason) {
      alertState = 'stress';
      alertReason = stressReason;
    }
    if (crisis) {
      alertState = 'crisis';
      alertReason = 'drawdown_stress_plus_var_stress_plus_tail';
    }

    return {
      configId: config.id,
      date: row.date,
      year: row.year,
      regime: row.regime,
      damage_state: damageState,
      alert_state: alertState,
      drawdown_state: drawdownState,
      duration_state: durationState,
      var_state: varState,
      ewma_state: ewmaState,
      tail_state: tailState,
      rolling_drawdown_pct: drawdownPct,
      historical_var_loss_pct: varLossPct,
      ewma_vol_pct: ewmaPct,
      daily_return_pct: dailyReturnPct,
      underwater_duration_days: value !== null ? underwaterDuration : null,
      recent_tail_loss_days: recentTailLossDays,
      alert_reason: alertReason
    };
  });
}

function stressReasonFor(config, s) {
  if (config.stressRule === 'drawdown_watch_plus_any_risk_signal') {
    const riskSignal = RANK[s.varState] >= RANK.watch || RANK[s.ewmaState] >= RANK.watch || RANK[s.tailState] >= RANK.watch;
    return RANK[s.drawdownState] >= RANK.watch && riskSignal ? 'drawdown_watch_plus_any_risk_signal' : null;
  }
  if (config.stressRule === 'drawdown_stress_or_drawdown_watch_plus_var_tail') {
    if (RANK[s.drawdownState] >= RANK.stress) return 'drawdown_stress';
    if (RANK[s.drawdownState] >= RANK.watch && RANK[s.varState] >= RANK.watch && s.recentTailLossDays >= TAIL_CLUSTER_COUNT) {
      return 'drawdown_watch_plus_var_watch_plus_tail';
    }
    if (RANK[s.drawdownState] >= RANK.watch && RANK[s.durationState] >= RANK.stress && (RANK[s.varState] >= RANK.watch || RANK[s.tailState] >= RANK.watch)) {
      return 'drawdown_watch_plus_duration_plus_risk_signal';
    }
    return null;
  }
  if (config.stressRule === 'var_watch_plus_ewma_watch_with_drawdown_watch') {
    return RANK[s.drawdownState] >= RANK.watch && RANK[s.varState] >= RANK.watch && RANK[s.ewmaState] >= RANK.watch
      ? 'var_watch_plus_ewma_watch_with_drawdown_watch'
      : null;
  }
  return null;
}

function transitions(signals) {
  const out = [];
  let current = null;
  for (const s of signals) {
    if (!current || current.state !== s.alert_state || current.year !== s.year) {
      if (current) out.push(current);
      current = {
        configId: s.configId,
        state: s.alert_state,
        year: s.year,
        regime: s.regime,
        startDate: s.date,
        endDate: s.date,
        durationDays: 1,
        maxDamageState: s.damage_state,
        maxDrawdownPct: s.rolling_drawdown_pct,
        maxVarLossPct: s.historical_var_loss_pct,
        maxEwmaPct: s.ewma_vol_pct,
        minDailyReturnPct: s.daily_return_pct
      };
      continue;
    }
    current.endDate = s.date;
    current.durationDays += 1;
    current.maxDamageState = RANK[s.damage_state] > RANK[current.maxDamageState] ? s.damage_state : current.maxDamageState;
    current.maxDrawdownPct = minNullable(current.maxDrawdownPct, s.rolling_drawdown_pct);
    current.maxVarLossPct = maxNullable(current.maxVarLossPct, s.historical_var_loss_pct);
    current.maxEwmaPct = maxNullable(current.maxEwmaPct, s.ewma_vol_pct);
    current.minDailyReturnPct = minNullable(current.minDailyReturnPct, s.daily_return_pct);
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

function countByState(rows, field) {
  return Object.fromEntries(STATES.map(state => [state, rows.filter(row => row[field] === state).length]));
}

function maxDuration(trans, state) {
  const rows = trans.filter(t => t.state === state);
  return rows.length ? Math.max(...rows.map(t => t.durationDays)) : 0;
}

function summarizeConfig(config, signals, trans) {
  const counts = countByState(signals, 'alert_state');
  const damageCounts = countByState(signals, 'damage_state');
  const stressOrCrisis = counts.stress + counts.crisis;
  const largeDrawdownRows = signals.filter(s => s.rolling_drawdown_pct !== null && s.rolling_drawdown_pct <= -35);
  const leadRows = largeDrawdownRows.filter(row => {
    const prior = signals.filter(s => s.year === row.year && s.date < row.date).slice(-7);
    return prior.some(s => RANK[s.alert_state] >= RANK.watch);
  });
  const falseNegativeRows = largeDrawdownRows.filter(s => RANK[s.alert_state] < RANK.watch);
  const stressYears = signals.filter(s => [2020, 2021, 2022].includes(s.year));
  const stressYearDrawdowns = stressYears.filter(s => s.rolling_drawdown_pct !== null && s.rolling_drawdown_pct <= -35);
  const stressYearFalseNegatives = stressYearDrawdowns.filter(s => RANK[s.alert_state] < RANK.watch);
  const bullRecovery = signals.filter(s => ['Bull market', 'Recovery', 'ETF/Bull'].includes(s.regime));

  return {
    configId: config.id,
    label: config.label,
    normalDays: counts.normal,
    watchDays: counts.watch,
    stressDays: counts.stress,
    crisisDays: counts.crisis,
    stressOrCrisisPct: roundNumber(stressOrCrisis / signals.length * 100),
    crisisPct: roundNumber(counts.crisis / signals.length * 100),
    damageStressOrCrisisPct: roundNumber((damageCounts.stress + damageCounts.crisis) / signals.length * 100),
    transitionCount: trans.length,
    maxStressEpisodeDays: maxDuration(trans, 'stress'),
    maxCrisisEpisodeDays: maxDuration(trans, 'crisis'),
    largeDrawdownLeadPct: roundNumber(leadRows.length / Math.max(largeDrawdownRows.length, 1) * 100),
    largeDrawdownFalseNegativePct: roundNumber(falseNegativeRows.length / Math.max(largeDrawdownRows.length, 1) * 100),
    stressYearsFalseNegativePct: roundNumber(stressYearFalseNegatives.length / Math.max(stressYearDrawdowns.length, 1) * 100),
    bullRecoveryStressOrCrisisPct: roundNumber(bullRecovery.filter(s => RANK[s.alert_state] >= RANK.stress).length / Math.max(bullRecovery.length, 1) * 100),
    bullRecoveryCrisisPct: roundNumber(bullRecovery.filter(s => s.alert_state === 'crisis').length / Math.max(bullRecovery.length, 1) * 100),
    recommended: config.id === 'v04b_actionable_stress_recommended'
  };
}

function yearlySummary(config, signals, trans) {
  return INPUTS.map(item => {
    const rows = signals.filter(s => s.year === item.year);
    const yearTrans = trans.filter(t => t.year === item.year);
    const counts = countByState(rows, 'alert_state');
    const damageCounts = countByState(rows, 'damage_state');
    const largeDrawdownRows = rows.filter(s => s.rolling_drawdown_pct !== null && s.rolling_drawdown_pct <= -35);
    const leadRows = largeDrawdownRows.filter(row => {
      const prior = rows.filter(s => s.date < row.date).slice(-7);
      return prior.some(s => RANK[s.alert_state] >= RANK.watch);
    });
    const falseNegatives = largeDrawdownRows.filter(s => RANK[s.alert_state] < RANK.watch);
    return {
      configId: config.id,
      year: item.year,
      regime: item.regime,
      normalDays: counts.normal,
      watchDays: counts.watch,
      stressDays: counts.stress,
      crisisDays: counts.crisis,
      stressOrCrisisPct: roundNumber((counts.stress + counts.crisis) / Math.max(rows.length, 1) * 100),
      crisisPct: roundNumber(counts.crisis / Math.max(rows.length, 1) * 100),
      damageStressOrCrisisPct: roundNumber((damageCounts.stress + damageCounts.crisis) / Math.max(rows.length, 1) * 100),
      transitionCount: yearTrans.length,
      maxStressEpisodeDays: maxDuration(yearTrans, 'stress'),
      maxCrisisEpisodeDays: maxDuration(yearTrans, 'crisis'),
      largeDrawdownLeadPct: roundNumber(leadRows.length / Math.max(largeDrawdownRows.length, 1) * 100),
      largeDrawdownFalseNegativePct: roundNumber(falseNegatives.length / Math.max(largeDrawdownRows.length, 1) * 100),
      maxDrawdownPct: roundNumber(Math.min(...rows.map(s => s.rolling_drawdown_pct).filter(Number.isFinite))),
      maxVarLossPct: roundNumber(Math.max(...rows.map(s => s.historical_var_loss_pct).filter(Number.isFinite))),
      maxEwmaPct: roundNumber(Math.max(...rows.map(s => s.ewma_vol_pct).filter(Number.isFinite)))
    };
  });
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildMarkdown(summaries, yearly, recommendation) {
  return [
    '# ETH Passive Hedge Monitoring Calibration v0.4',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- Inputs: existing ETH Weekly OTM05 Daily MTM artifact for 2025.',
    '- Methodology: BTC Passive Hedge Monitoring v0.4b thresholds and state rules, replicated without threshold changes.',
    '- No hedge execution and no Daily MTM regeneration.',
    '- This is research-grade support for live/manual snapshot generation, not a production hedge policy.',
    '',
    '## Configuration Comparison',
    '',
    markdownTable(summaries, ['configId', 'normalDays', 'watchDays', 'stressDays', 'crisisDays', 'stressOrCrisisPct', 'crisisPct', 'damageStressOrCrisisPct', 'transitionCount', 'maxStressEpisodeDays', 'maxCrisisEpisodeDays', 'largeDrawdownLeadPct', 'largeDrawdownFalseNegativePct', 'recommended']),
    '',
    '## Recommendation',
    '',
    `Recommended v0.4 set: ${recommendation.configId}.`,
    '',
    '- v0.4b is retained because it is the current BTC research baseline.',
    '- ETH calibration is limited by the currently available ETH Daily MTM scope.',
    '- Funding, basis, slippage, custody, margin, and hedge latency remain outside this layer.',
    '',
    '## Recommended Variant Yearly Detail',
    '',
    markdownTable(yearly.filter(row => row.configId === recommendation.configId), ['year', 'regime', 'normalDays', 'watchDays', 'stressDays', 'crisisDays', 'stressOrCrisisPct', 'crisisPct', 'damageStressOrCrisisPct', 'transitionCount', 'maxStressEpisodeDays', 'maxCrisisEpisodeDays', 'largeDrawdownLeadPct', 'largeDrawdownFalseNegativePct']),
    ''
  ].join('\n');
}

function main() {
  const rows = loadRows();
  const summaries = [];
  const allYearly = [];
  const allTransitions = [];
  let recommendedSignals = null;

  for (const config of CONFIGS) {
    const signals = buildSignals(rows, config);
    const trans = transitions(signals);
    const yearly = yearlySummary(config, signals, trans);
    const summary = summarizeConfig(config, signals, trans);
    summaries.push(summary);
    allYearly.push(...yearly);
    allTransitions.push(...trans.map(t => ({ configId: config.id, ...t })));
    if (summary.recommended) recommendedSignals = signals;
  }

  const recommendation = summaries.find(s => s.recommended);
  const generatedAt = new Date().toISOString();
  fs.mkdirSync(OUTPUT_DIR_V04, { recursive: true });
  fs.writeFileSync(OUTPUT_CONFIGS_JSON, `${JSON.stringify({ generatedAt, asset: 'ETH', thresholds: THRESHOLDS, configs: CONFIGS }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SUMMARY_CSV, `${objectsToCsv(summaries, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SUMMARY_JSON, `${JSON.stringify({ generatedAt, asset: 'ETH', recommendation, summaries, yearly: allYearly }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(allYearly, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_TRANSITIONS_CSV, `${objectsToCsv(allTransitions, TRANSITION_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SIGNALS_CSV, `${objectsToCsv(recommendedSignals, SIGNAL_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SIGNALS_JSON, `${JSON.stringify({ generatedAt, asset: 'ETH', configId: recommendation.configId, rows: recommendedSignals }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildMarkdown(summaries, allYearly, recommendation), 'utf8');

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CONFIGS_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SUMMARY_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SUMMARY_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_YEARLY_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_TRANSITIONS_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SIGNALS_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_SIGNALS_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FINDINGS_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building ETH passive hedge monitoring v0.4:', error.stack || error.message);
    process.exitCode = 1;
  }
}
