const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const OUTPUT_CSV = path.join(INPUT_DIR, 'btc_rolling_findings_summary.csv');
const OUTPUT_JSON = path.join(INPUT_DIR, 'btc_rolling_findings_summary.json');
const OUTPUT_MD = path.join(INPUT_DIR, 'btc_rolling_findings_summary.md');

const ROLLING_JSON = path.join(INPUT_DIR, 'btc_rolling_risk_analysis.json');
const EQUITY_JSON = path.join(INPUT_DIR, 'btc_equity_risk_analysis.json');
const REGIME_JSON = path.join(INPUT_DIR, 'btc_regime_analysis.json');
const MULTI_TENOR_JSON = path.join(INPUT_DIR, 'btc_multi_tenor_analysis.json');

const PRIMARY_WINDOW_BY_TENOR = {
  weekly: 52,
  '14d': 26,
  monthly: 12
};

const REGIMES = [
  { label: 'bull_2020_2021', name: 'Bull', start: '2020-01-01', end: '2021-12-31T23:59:59Z' },
  { label: 'bear_2022', name: 'Bear', start: '2022-01-01', end: '2022-12-31T23:59:59Z' },
  { label: 'recovery_transition_2023', name: 'Recovery/transition', start: '2023-01-01', end: '2023-12-31T23:59:59Z' },
  { label: 'etf_bull_2024_2025', name: 'ETF/bull', start: '2024-01-01', end: '2025-12-31T23:59:59Z' }
];

const OUTPUT_COLUMNS = [
  'row_type',
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'source_batch_name',
  'comparison_scope',
  'windowCycles',
  'rollingWindowCount',
  'averageWindowReturnPct',
  'stdevWindowReturnPct',
  'positiveWindowPct',
  'negativeWindowPct',
  'averageRollingVolatilityPct',
  'stdevRollingVolatilityPct',
  'p90RollingVolatilityPct',
  'maxRollingVolatilityPct',
  'volatilitySpikeThresholdPct',
  'volatilitySpikeCount',
  'volatilitySpikeBearPct',
  'longestElevatedVolatilityRun',
  'averageRollingDrawdownPct',
  'stdevRollingDrawdownPct',
  'worstRollingDrawdownPct',
  'severeDrawdownWindowPct',
  'longestDrawdownRun',
  'longestSevereDrawdownRun',
  'averageRegimeReturnSpreadPct',
  'bestRegime',
  'worstRegime',
  'notes'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function objectsToCsv(rows, columns) {
  const escapeValue = value => {
    if (value === null || value === undefined) return '';
    const raw = Array.isArray(value) ? value.join('; ') : String(value);
    if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => escapeValue(row[column])).join(','))
  ].join('\n');
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundNumber(value, decimals = 6) {
  const number = optionalNumber(value);
  if (number === null) return null;
  const factor = 10 ** decimals;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function sampleStdDev(values) {
  const nums = values.filter(value => Number.isFinite(value));
  if (nums.length < 2) return null;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (nums.length - 1));
}

function percentile(values, p) {
  const nums = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const index = (nums.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return nums[lower];
  return nums[lower] + (nums[upper] - nums[lower]) * (index - lower);
}

function pct(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value);
  const normalized = raw.includes('T') ? raw : `${raw}T00:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function regimeForDate(value) {
  const date = parseDate(value);
  if (!date) return null;
  return REGIMES.find(regime => {
    const start = parseDate(regime.start);
    const end = parseDate(regime.end);
    return date >= start && date <= end;
  }) || null;
}

function longestRun(rows, predicate) {
  let current = 0;
  let longest = 0;
  for (const row of rows) {
    if (predicate(row)) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function groupBy(rows, keyFn) {
  return rows.reduce((groups, row) => {
    const key = keyFn(row);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
    return groups;
  }, {});
}

function avgField(rows, field) {
  return mean(rows.map(row => optionalNumber(row[field])).filter(value => value !== null));
}

function maxField(rows, field) {
  const values = rows.map(row => optionalNumber(row[field])).filter(value => value !== null);
  return values.length ? Math.max(...values) : null;
}

function minField(rows, field) {
  const values = rows.map(row => optionalNumber(row[field])).filter(value => value !== null);
  return values.length ? Math.min(...values) : null;
}

function summarizeConfig(rows) {
  const ordered = rows.slice().sort((a, b) => optionalNumber(a.windowEndSequence) - optionalNumber(b.windowEndSequence));
  const returns = ordered.map(row => optionalNumber(row.windowReturnPct)).filter(value => value !== null);
  const rollingVols = ordered.map(row => optionalNumber(row.rollingVolatilityPct)).filter(value => value !== null);
  const rollingDrawdowns = ordered.map(row => optionalNumber(row.rollingDrawdownPct)).filter(value => value !== null);
  const volThreshold = percentile(rollingVols, 0.9);
  const elevatedVolThreshold = percentile(rollingVols, 0.75);
  const volatilitySpikeRows = volThreshold === null
    ? []
    : ordered.filter(row => optionalNumber(row.rollingVolatilityPct) >= volThreshold);
  const bearSpikeCount = volatilitySpikeRows.filter(row => {
    const regime = regimeForDate(row.windowEndDate);
    return regime && regime.label === 'bear_2022';
  }).length;

  const regimeRows = Object.entries(groupBy(ordered, row => {
    const regime = regimeForDate(row.windowEndDate);
    return regime ? regime.label : 'outside_regimes';
  })).map(([regimeLabel, regimeWindowRows]) => ({
    regime_label: regimeLabel,
    windowCount: regimeWindowRows.length,
    averageWindowReturnPct: mean(regimeWindowRows.map(row => optionalNumber(row.windowReturnPct)).filter(value => value !== null)),
    averageRollingVolatilityPct: mean(regimeWindowRows.map(row => optionalNumber(row.rollingVolatilityPct)).filter(value => value !== null)),
    averageRollingDrawdownPct: mean(regimeWindowRows.map(row => optionalNumber(row.rollingDrawdownPct)).filter(value => value !== null))
  })).filter(row => row.regime_label !== 'outside_regimes');

  const bestRegime = regimeRows
    .filter(row => row.averageWindowReturnPct !== null)
    .sort((a, b) => b.averageWindowReturnPct - a.averageWindowReturnPct)[0] || null;
  const worstRegime = regimeRows
    .filter(row => row.averageWindowReturnPct !== null)
    .sort((a, b) => a.averageWindowReturnPct - b.averageWindowReturnPct)[0] || null;
  const regimeReturnValues = regimeRows.map(row => row.averageWindowReturnPct).filter(value => Number.isFinite(value));
  const regimeSpread = regimeReturnValues.length
    ? Math.max(...regimeReturnValues) - Math.min(...regimeReturnValues)
    : null;

  const first = ordered[0] || {};
  return {
    row_type: 'configuration',
    asset: first.asset || 'BTC',
    tenor: first.tenor,
    moneyness_label: first.moneyness_label,
    xOtm: roundNumber(first.xOtm),
    source_batch_name: first.source_batch_name,
    comparison_scope: first.comparison_scope,
    windowCycles: optionalNumber(first.windowCycles),
    rollingWindowCount: ordered.length,
    averageWindowReturnPct: roundNumber(mean(returns)),
    stdevWindowReturnPct: roundNumber(sampleStdDev(returns)),
    positiveWindowPct: roundNumber(pct(returns.filter(value => value > 0).length, returns.length)),
    negativeWindowPct: roundNumber(pct(returns.filter(value => value < 0).length, returns.length)),
    averageRollingVolatilityPct: roundNumber(mean(rollingVols)),
    stdevRollingVolatilityPct: roundNumber(sampleStdDev(rollingVols)),
    p90RollingVolatilityPct: roundNumber(percentile(rollingVols, 0.9)),
    maxRollingVolatilityPct: roundNumber(maxField(ordered, 'rollingVolatilityPct')),
    volatilitySpikeThresholdPct: roundNumber(volThreshold),
    volatilitySpikeCount: volatilitySpikeRows.length,
    volatilitySpikeBearPct: roundNumber(pct(bearSpikeCount, volatilitySpikeRows.length)),
    longestElevatedVolatilityRun: elevatedVolThreshold === null
      ? null
      : longestRun(ordered, row => optionalNumber(row.rollingVolatilityPct) >= elevatedVolThreshold),
    averageRollingDrawdownPct: roundNumber(mean(rollingDrawdowns)),
    stdevRollingDrawdownPct: roundNumber(sampleStdDev(rollingDrawdowns)),
    worstRollingDrawdownPct: roundNumber(minField(ordered, 'rollingDrawdownPct')),
    severeDrawdownWindowPct: roundNumber(pct(rollingDrawdowns.filter(value => value <= -20).length, rollingDrawdowns.length)),
    longestDrawdownRun: longestRun(ordered, row => optionalNumber(row.rollingDrawdownPct) < 0),
    longestSevereDrawdownRun: longestRun(ordered, row => optionalNumber(row.rollingDrawdownPct) <= -20),
    averageRegimeReturnSpreadPct: roundNumber(regimeSpread),
    bestRegime: bestRegime ? bestRegime.regime_label : null,
    worstRegime: worstRegime ? worstRegime.regime_label : null,
    notes: ''
  };
}

function summarizeTenor(configRows, tenor) {
  const rows = configRows.filter(row => row.tenor === tenor && row.comparison_scope === 'full_period');
  return {
    row_type: 'tenor',
    asset: 'BTC',
    tenor,
    moneyness_label: 'ALL',
    xOtm: null,
    source_batch_name: null,
    comparison_scope: 'full_period',
    windowCycles: PRIMARY_WINDOW_BY_TENOR[tenor],
    rollingWindowCount: rows.reduce((sum, row) => sum + (row.rollingWindowCount || 0), 0),
    averageWindowReturnPct: roundNumber(avgField(rows, 'averageWindowReturnPct')),
    stdevWindowReturnPct: roundNumber(avgField(rows, 'stdevWindowReturnPct')),
    positiveWindowPct: roundNumber(avgField(rows, 'positiveWindowPct')),
    negativeWindowPct: roundNumber(avgField(rows, 'negativeWindowPct')),
    averageRollingVolatilityPct: roundNumber(avgField(rows, 'averageRollingVolatilityPct')),
    stdevRollingVolatilityPct: roundNumber(avgField(rows, 'stdevRollingVolatilityPct')),
    p90RollingVolatilityPct: roundNumber(avgField(rows, 'p90RollingVolatilityPct')),
    maxRollingVolatilityPct: roundNumber(avgField(rows, 'maxRollingVolatilityPct')),
    volatilitySpikeThresholdPct: roundNumber(avgField(rows, 'volatilitySpikeThresholdPct')),
    volatilitySpikeCount: rows.reduce((sum, row) => sum + (row.volatilitySpikeCount || 0), 0),
    volatilitySpikeBearPct: roundNumber(avgField(rows, 'volatilitySpikeBearPct')),
    longestElevatedVolatilityRun: maxField(rows, 'longestElevatedVolatilityRun'),
    averageRollingDrawdownPct: roundNumber(avgField(rows, 'averageRollingDrawdownPct')),
    stdevRollingDrawdownPct: roundNumber(avgField(rows, 'stdevRollingDrawdownPct')),
    worstRollingDrawdownPct: roundNumber(minField(rows, 'worstRollingDrawdownPct')),
    severeDrawdownWindowPct: roundNumber(avgField(rows, 'severeDrawdownWindowPct')),
    longestDrawdownRun: maxField(rows, 'longestDrawdownRun'),
    longestSevereDrawdownRun: maxField(rows, 'longestSevereDrawdownRun'),
    averageRegimeReturnSpreadPct: roundNumber(avgField(rows, 'averageRegimeReturnSpreadPct')),
    bestRegime: null,
    worstRegime: null,
    notes: `Average of ${rows.length} full-period ${tenor} configurations using the primary tenor window.`
  };
}

function buildRegimeTenorSummary(primaryRows) {
  const rows = primaryRows.filter(row => row.comparison_scope === 'full_period');
  return Object.entries(groupBy(rows, row => {
    const regime = regimeForDate(row.windowEndDate);
    return `${regime ? regime.label : 'outside_regimes'}|${row.tenor}`;
  })).map(([key, groupRows]) => {
    const [regimeLabel, tenor] = key.split('|');
    return {
      regime_label: regimeLabel,
      tenor,
      windowCount: groupRows.length,
      averageWindowReturnPct: roundNumber(mean(groupRows.map(row => optionalNumber(row.windowReturnPct)).filter(value => value !== null))),
      positiveWindowPct: roundNumber(pct(groupRows.filter(row => optionalNumber(row.windowReturnPct) > 0).length, groupRows.length)),
      averageRollingVolatilityPct: roundNumber(mean(groupRows.map(row => optionalNumber(row.rollingVolatilityPct)).filter(value => value !== null))),
      averageRollingDrawdownPct: roundNumber(mean(groupRows.map(row => optionalNumber(row.rollingDrawdownPct)).filter(value => value !== null))),
      severeDrawdownWindowPct: roundNumber(pct(groupRows.filter(row => optionalNumber(row.rollingDrawdownPct) <= -20).length, groupRows.length))
    };
  }).filter(row => row.regime_label !== 'outside_regimes')
    .sort((a, b) => a.regime_label.localeCompare(b.regime_label) || a.tenor.localeCompare(b.tenor));
}

function rank(rows, field, direction = 'desc') {
  return rows
    .filter(row => optionalNumber(row[field]) !== null)
    .slice()
    .sort((a, b) => {
      const delta = optionalNumber(a[field]) - optionalNumber(b[field]);
      return direction === 'asc' ? delta : -delta;
    });
}

function describeLeader(row, field, suffix = '') {
  if (!row) return 'n/a';
  const label = row.row_type === 'tenor'
    ? row.tenor
    : `${row.tenor} ${row.moneyness_label}`;
  return `${label} (${row[field]}${suffix})`;
}

function buildFindings({ tenorRows, configRows, regimeTenorSummary, multiTenorRows, equityRows }) {
  const stableReturn = rank(tenorRows, 'stdevWindowReturnPct', 'asc')[0];
  const stableVol = rank(tenorRows, 'stdevRollingVolatilityPct', 'asc')[0];
  const stableDrawdown = rank(tenorRows, 'stdevRollingDrawdownPct', 'asc')[0];
  const bestPositive = rank(tenorRows, 'positiveWindowPct', 'desc')[0];
  const bestReturn = rank(tenorRows, 'averageWindowReturnPct', 'desc')[0];
  const lowestSevereDrawdown = rank(tenorRows, 'severeDrawdownWindowPct', 'asc')[0];
  const highestSpikeBear = rank(tenorRows, 'volatilitySpikeBearPct', 'desc')[0];
  const lowestAvgVol = rank(tenorRows, 'averageRollingVolatilityPct', 'asc')[0];
  const weekly = tenorRows.find(row => row.tenor === 'weekly');
  const d14 = tenorRows.find(row => row.tenor === '14d');
  const monthly = tenorRows.find(row => row.tenor === 'monthly');

  const regimeNotes = REGIMES.map(regime => {
    const rows = regimeTenorSummary.filter(row => row.regime_label === regime.label);
    const leader = rank(rows, 'averageWindowReturnPct', 'desc')[0];
    const volLow = rank(rows, 'averageRollingVolatilityPct', 'asc')[0];
    return {
      regime: regime.label,
      returnLeader: leader ? leader.tenor : null,
      returnLeaderValue: leader ? leader.averageWindowReturnPct : null,
      lowestVolTenor: volLow ? volLow.tenor : null,
      lowestVolValue: volLow ? volLow.averageRollingVolatilityPct : null
    };
  });

  const multiTenorLeader = rank(
    multiTenorRows.filter(row => row.comparison_scope === 'full_period'),
    'totalReturnPct',
    'desc'
  )[0];
  const equitySharpeLeader = rank(
    equityRows.filter(row => row.comparison_scope === 'full_period'),
    'SharpeSimple',
    'desc'
  )[0];

  return {
    observations: [
      `${describeLeader(bestReturn, 'averageWindowReturnPct', '%')} has the highest average one-year rolling window return across tenor averages.`,
      `${describeLeader(bestPositive, 'positiveWindowPct', '%')} has the highest positive rolling-window frequency across tenor averages.`,
      `${describeLeader(stableReturn, 'stdevWindowReturnPct', ' pp')} has the most stable rolling returns by standard deviation of window returns.`,
      `${describeLeader(stableVol, 'stdevRollingVolatilityPct', ' pp')} has the most stable rolling volatility path by standard deviation of rolling volatility.`,
      `${describeLeader(stableDrawdown, 'stdevRollingDrawdownPct', ' pp')} has the most stable rolling drawdown path by standard deviation of rolling drawdown.`,
      `${describeLeader(lowestAvgVol, 'averageRollingVolatilityPct', ' pp')} has the lowest average rolling volatility, using cycle-return percentage point volatility.`,
      `${describeLeader(lowestSevereDrawdown, 'severeDrawdownWindowPct', '%')} has the lowest severe-drawdown window frequency at the -20% rolling drawdown threshold.`,
      `${describeLeader(highestSpikeBear, 'volatilitySpikeBearPct', '%')} has the largest share of top-decile volatility windows ending in the 2022 bear regime.`,
      `The summary-level total-return leader remains ${multiTenorLeader ? `${multiTenorLeader.tenor} ${multiTenorLeader.moneyness_label}` : 'n/a'}, while the simple cycle Sharpe leader is ${equitySharpeLeader ? `${equitySharpeLeader.tenor} ${equitySharpeLeader.moneyness_label}` : 'n/a'}.`
    ],
    hypotheses: [
      weekly && monthly && weekly.averageWindowReturnPct > monthly.averageWindowReturnPct
        ? 'Weekly return dominance appears tied to stronger rolling upside participation, but the rolling layer suggests that dominance comes with more unstable drawdown behavior than lower-frequency tenors.'
        : 'Weekly return dominance is not uniform in the rolling summary and should be interpreted as regime-dependent rather than unconditional.',
      d14 && weekly && monthly
        ? '14d behaves like an intermediate repricing regime in several rolling measures, sitting between weekly and monthly on return, volatility, or drawdown behavior depending on the metric.'
        : '14d smoothing behavior could not be fully evaluated from the available rows.',
      monthly && weekly && monthly.averageRollingVolatilityPct < weekly.averageRollingVolatilityPct
        ? 'Monthly appears to dampen rolling volatility in cycle-volatility terms, but this lower instability may come at the cost of lower convex upside capture versus weekly OTM05/OTM10.'
        : 'Monthly volatility damping is not universal across all rolling measures and needs annualized normalization before being treated as a risk-adjusted conclusion.'
    ],
    regimeTransitionNotes: regimeNotes
  };
}

function markdownTable(rows, columns) {
  if (!rows.length) return '';
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`);
  return [header, separator, ...body].join('\n');
}

function buildMarkdown(analysis) {
  const tenorRows = analysis.rows.filter(row => row.row_type === 'tenor');
  return [
    '# BTC Rolling-Risk Findings Summary',
    '',
    `Generated: ${analysis.generatedAt}`,
    '',
    '## Findings',
    '',
    ...analysis.findings.observations.map(item => `- ${item}`),
    '',
    '## Tenor Summary',
    '',
    markdownTable(tenorRows, [
      'tenor',
      'windowCycles',
      'averageWindowReturnPct',
      'positiveWindowPct',
      'averageRollingVolatilityPct',
      'stdevRollingVolatilityPct',
      'averageRollingDrawdownPct',
      'worstRollingDrawdownPct',
      'severeDrawdownWindowPct'
    ]),
    '',
    '## Hypotheses',
    '',
    ...analysis.findings.hypotheses.map(item => `- ${item}`),
    '',
    '## Regime Behavior',
    '',
    markdownTable(analysis.regimeTenorSummary, [
      'regime_label',
      'tenor',
      'averageWindowReturnPct',
      'positiveWindowPct',
      'averageRollingVolatilityPct',
      'averageRollingDrawdownPct',
      'severeDrawdownWindowPct'
    ]),
    '',
    '## Methodology Notes',
    '',
    '- Primary rolling comparison uses tenor-aware one-year windows: weekly 52 cycles, 14d 26 cycles, monthly 12 cycles.',
    '- Rolling volatility is the sample standard deviation of cycle return percentages inside a rolling window.',
    '- These volatility metrics are cycle-based, not annualized.',
    '- Current Sharpe and Sortino inputs in the deep-risk layer are tenor-dependent and not annualized.',
    '- Volatility spike analysis uses each configuration\'s top decile of rolling volatility windows and measures how many end in the 2022 bear regime.',
    '- Severe drawdown windows use a simple -20% rolling drawdown threshold.',
    '- Observations describe measured output behavior; hypotheses are interpretive and should not be treated as causal proof.',
    '',
    '## Limitations',
    '',
    '- Rolling windows overlap, so persistence metrics describe rolling-window persistence rather than independent samples.',
    '- Window end date is used for regime assignment, which can blur transitions when a window spans two regimes.',
    '- Cycle-volatility values are not directly comparable to annualized volatility until tenor-normalized columns are added.',
    '- The layer is still summary/interpretation only and does not inspect intracycle mark-to-market paths.',
    ''
  ].join('\n');
}

function buildAnalysis() {
  const rolling = readJson(ROLLING_JSON);
  const equity = readJson(EQUITY_JSON);
  const regime = readJson(REGIME_JSON);
  const multiTenor = readJson(MULTI_TENOR_JSON);

  const primaryRows = rolling.rows.filter(row => (
    row.comparison_scope === 'full_period'
    && optionalNumber(row.windowCycles) === PRIMARY_WINDOW_BY_TENOR[row.tenor]
  ));

  const configRows = Object.values(groupBy(
    primaryRows,
    row => `${row.tenor}|${row.moneyness_label}|${row.source_batch_name}`
  )).map(summarizeConfig);

  const tenorRows = ['weekly', '14d', 'monthly']
    .filter(tenor => configRows.some(row => row.tenor === tenor && row.comparison_scope === 'full_period'))
    .map(tenor => summarizeTenor(configRows, tenor));

  const rows = [...tenorRows, ...configRows].sort((a, b) => (
    a.row_type.localeCompare(b.row_type)
    || String(a.tenor).localeCompare(String(b.tenor))
    || (optionalNumber(a.xOtm) ?? -999) - (optionalNumber(b.xOtm) ?? -999)
    || String(a.source_batch_name || '').localeCompare(String(b.source_batch_name || ''))
  ));

  const regimeTenorSummary = buildRegimeTenorSummary(primaryRows);
  const findings = buildFindings({
    tenorRows,
    configRows,
    regimeTenorSummary,
    multiTenorRows: multiTenor.rows || [],
    equityRows: equity.rows || []
  });

  return {
    generatedAt: new Date().toISOString(),
    inputs: {
      rolling: path.relative(REPO_ROOT, ROLLING_JSON),
      equity: path.relative(REPO_ROOT, EQUITY_JSON),
      regime: path.relative(REPO_ROOT, REGIME_JSON),
      multiTenor: path.relative(REPO_ROOT, MULTI_TENOR_JSON)
    },
    outputs: {
      csv: path.relative(REPO_ROOT, OUTPUT_CSV),
      json: path.relative(REPO_ROOT, OUTPUT_JSON),
      markdown: path.relative(REPO_ROOT, OUTPUT_MD)
    },
    methodology: {
      primaryWindowPolicy: PRIMARY_WINDOW_BY_TENOR,
      volatilityUnits: 'Cycle-return percentage points, not annualized volatility.',
      sharpeSortinoNote: 'Deep-risk SharpeSimple and SortinoSimple are per-cycle ratios and are not tenor-normalized.',
      volatilitySpikeRule: 'Configuration-level rolling volatility windows at or above the 90th percentile are volatility spikes.',
      elevatedVolatilityRunRule: 'Longest consecutive run at or above the 75th percentile rolling volatility for that configuration.',
      severeDrawdownRule: 'Rolling drawdown <= -20%.',
      regimeAssignment: 'Rolling windows are assigned to regimes by windowEndDate.'
    },
    validation: {
      rollingInputRows: rolling.validation ? rolling.validation.rowCount : (rolling.rows || []).length,
      equityInputRows: equity.validation ? equity.validation.rowCount : (equity.rows || []).length,
      regimeInputRows: regime.validation ? regime.validation.rowCount : (regime.rows || []).length,
      multiTenorInputRows: multiTenor.validation ? multiTenor.validation.rowCount : (multiTenor.rows || []).length,
      outputRows: rows.length,
      configRows: configRows.length,
      tenorRows: tenorRows.length,
      tenorsPresent: [...new Set(rows.map(row => row.tenor).filter(Boolean))].sort(),
      regimesPresent: [...new Set(regimeTenorSummary.map(row => row.regime_label))].sort(),
      missingPathWarnings: [
        ...(equity.rows || []),
        ...(regime.rows || [])
      ].flatMap(row => row.warnings || []).filter(warning => String(warning).includes('missing_trades_csv'))
    },
    findings,
    regimeTenorSummary,
    rows
  };
}

function main() {
  const analysis = buildAnalysis();
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(analysis.rows, OUTPUT_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(analysis), 'utf8');

  console.log(`Generated ${analysis.validation.outputRows} rolling findings rows`);
  console.log(`Tenors: ${analysis.validation.tenorsPresent.join(', ')}`);
  console.log(`Regimes: ${analysis.validation.regimesPresent.join(', ')}`);
  console.log(`Missing path warnings: ${analysis.validation.missingPathWarnings.length}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC rolling findings summary:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis
};
