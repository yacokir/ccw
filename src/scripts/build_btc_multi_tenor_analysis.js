const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INPUT_CSV = path.join(REPO_ROOT, 'analysis', 'generated', 'btc_multi_tenor_risk_summary.csv');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'btc_multi_tenor_analysis.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'btc_multi_tenor_analysis.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'btc_multi_tenor_analysis.md');

const ANALYSIS_COLUMNS = [
  'asset',
  'tenor',
  'moneyness_label',
  'xOtm',
  'source_batch_name',
  'comparison_scope',
  'startYear',
  'endYear',
  'startDate',
  'endDate',
  'sample_years',
  'totalReturnPct',
  'btcReturnPct',
  'excessReturnVsBtcPct',
  'cagrPct',
  'return_vs_btc_ratio',
  'premium_to_underlying_pnl_ratio',
  'annualized_return_per_cycle',
  'excess_return_per_year',
  'option_coverage_efficiency',
  'fallback_penalty_proxy',
  'fallback_adjusted_return_score',
  'cycles_per_year',
  'premium_capture_density',
  'underlying_capture_ratio',
  'totalPnL',
  'totalPnLCall',
  'totalPnLUnderlying',
  'totalCycles',
  'observedOptionCoveragePct',
  'theoreticalFallbackCoveragePct',
  'settlementFallbackCoveragePct',
  'maxDrawdownPct',
  'sharpeRatio',
  'sortinoRatio',
  'worstCycleReturnPct',
  'warnings'
];

function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(value);
      value = '';
    } else {
      value += char;
    }
  }

  cells.push(value);
  return cells;
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === '' ? null : values[index];
    });
    return row;
  });
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

function safeDivide(numerator, denominator) {
  const n = optionalNumber(numerator);
  const d = optionalNumber(denominator);
  if (n === null || d === null || d === 0) return null;
  return n / d;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value);
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const normalized = ddmmyyyy
    ? `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}T00:00:00Z`
    : raw.includes('T') ? raw : `${raw}T00:00:00Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearsBetween(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end || end <= start) return null;
  return (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function pctToDecimal(value) {
  const number = optionalNumber(value);
  return number === null ? null : number / 100;
}

function comparisonScope(row) {
  return Number(row.startYear) === 2020 && Number(row.endYear) === 2026
    ? 'full_period'
    : 'partial_period';
}

function deriveRow(row) {
  const warnings = [];
  const sampleYears = yearsBetween(row.startDate, row.endDate);
  const totalReturnPct = optionalNumber(row.totalReturnPct);
  const btcReturnPct = optionalNumber(row.btcReturnPct);
  const excessReturnVsBtcPct = optionalNumber(row.excessReturnVsBtcPct);
  const cagrPct = optionalNumber(row.cagrPct);
  const totalCycles = optionalNumber(row.totalCycles);
  const observedCoveragePct = optionalNumber(row.observedOptionCoveragePct);
  const theoreticalFallbackCoveragePct = optionalNumber(row.theoreticalFallbackCoveragePct) || 0;
  const settlementFallbackCoveragePct = optionalNumber(row.settlementFallbackCoveragePct) || 0;
  const totalPnL = optionalNumber(row.totalPnL);
  const totalPnLCall = optionalNumber(row.totalPnLCall);
  const totalPnLUnderlying = optionalNumber(row.totalPnLUnderlying);

  if (comparisonScope(row) !== 'full_period') warnings.push('partial_period_excluded_from_primary_rankings');
  if (sampleYears === null) warnings.push('invalid_or_missing_date_range');
  if (totalCycles === null || totalCycles <= 0) warnings.push('invalid_or_missing_total_cycles');
  if (observedCoveragePct !== null && (observedCoveragePct < 0 || observedCoveragePct > 100)) {
    warnings.push('observed_option_coverage_out_of_range');
  }

  const fallbackPenaltyProxy = theoreticalFallbackCoveragePct + settlementFallbackCoveragePct;
  const cyclesPerYear = sampleYears && totalCycles ? totalCycles / sampleYears : null;
  const returnVsBtcRatio = safeDivide(totalReturnPct, btcReturnPct);
  const coverageDecimal = pctToDecimal(observedCoveragePct);
  const fallbackPenaltyDecimal = fallbackPenaltyProxy / 100;

  return {
    asset: row.asset,
    tenor: row.tenor,
    moneyness_label: row.moneyness_label,
    xOtm: roundNumber(row.xOtm),
    source_batch_name: row.source_batch_name,
    comparison_scope: comparisonScope(row),
    startYear: optionalNumber(row.startYear),
    endYear: optionalNumber(row.endYear),
    startDate: row.startDate,
    endDate: row.endDate,
    sample_years: roundNumber(sampleYears),
    totalReturnPct: roundNumber(totalReturnPct),
    btcReturnPct: roundNumber(btcReturnPct),
    excessReturnVsBtcPct: roundNumber(excessReturnVsBtcPct),
    cagrPct: roundNumber(cagrPct),
    return_vs_btc_ratio: roundNumber(returnVsBtcRatio),
    premium_to_underlying_pnl_ratio: roundNumber(safeDivide(totalPnLCall, totalPnLUnderlying)),
    annualized_return_per_cycle: roundNumber(safeDivide(cagrPct, cyclesPerYear)),
    excess_return_per_year: roundNumber(safeDivide(excessReturnVsBtcPct, sampleYears)),
    option_coverage_efficiency: roundNumber(returnVsBtcRatio !== null && coverageDecimal !== null
      ? returnVsBtcRatio * coverageDecimal
      : null),
    fallback_penalty_proxy: roundNumber(fallbackPenaltyProxy),
    fallback_adjusted_return_score: roundNumber(totalReturnPct !== null
      ? totalReturnPct * (1 - fallbackPenaltyDecimal)
      : null),
    cycles_per_year: roundNumber(cyclesPerYear),
    premium_capture_density: roundNumber(safeDivide(totalPnLCall, totalCycles)),
    underlying_capture_ratio: roundNumber(safeDivide(totalPnLUnderlying, totalPnL)),
    totalPnL: roundNumber(totalPnL),
    totalPnLCall: roundNumber(totalPnLCall),
    totalPnLUnderlying: roundNumber(totalPnLUnderlying),
    totalCycles,
    observedOptionCoveragePct: roundNumber(observedCoveragePct),
    theoreticalFallbackCoveragePct: roundNumber(theoreticalFallbackCoveragePct),
    settlementFallbackCoveragePct: roundNumber(settlementFallbackCoveragePct),
    maxDrawdownPct: null,
    sharpeRatio: null,
    sortinoRatio: null,
    worstCycleReturnPct: null,
    warnings
  };
}

function rankRows(rows, metric, direction = 'desc', limit = 5) {
  return rows
    .filter(row => optionalNumber(row[metric]) !== null)
    .slice()
    .sort((a, b) => {
      const delta = optionalNumber(a[metric]) - optionalNumber(b[metric]);
      return direction === 'asc' ? delta : -delta;
    })
    .slice(0, limit)
    .map((row, index) => ({
      rank: index + 1,
      metric,
      value: row[metric],
      tenor: row.tenor,
      moneyness_label: row.moneyness_label,
      source_batch_name: row.source_batch_name
    }));
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    if (!groups[value]) groups[value] = [];
    groups[value].push(row);
    return groups;
  }, {});
}

function average(rows, field) {
  const values = rows.map(row => optionalNumber(row[field])).filter(value => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxBy(rows, field) {
  return rows
    .filter(row => optionalNumber(row[field]) !== null)
    .slice()
    .sort((a, b) => optionalNumber(b[field]) - optionalNumber(a[field]))[0] || null;
}

function buildTenorSummary(rows) {
  return Object.entries(groupBy(rows, 'tenor')).map(([tenor, tenorRows]) => {
    const bestTotalReturn = maxBy(tenorRows, 'totalReturnPct');
    return {
      tenor,
      variantCount: tenorRows.length,
      averageTotalReturnPct: roundNumber(average(tenorRows, 'totalReturnPct')),
      averageCagrPct: roundNumber(average(tenorRows, 'cagrPct')),
      averageExcessReturnVsBtcPct: roundNumber(average(tenorRows, 'excessReturnVsBtcPct')),
      averageObservedOptionCoveragePct: roundNumber(average(tenorRows, 'observedOptionCoveragePct')),
      averageFallbackPenaltyProxy: roundNumber(average(tenorRows, 'fallback_penalty_proxy')),
      bestTotalReturnVariant: bestTotalReturn ? bestTotalReturn.moneyness_label : null,
      bestTotalReturnPct: bestTotalReturn ? bestTotalReturn.totalReturnPct : null
    };
  }).sort((a, b) => b.averageTotalReturnPct - a.averageTotalReturnPct);
}

function bestMoneynessPerTenor(rows) {
  return Object.entries(groupBy(rows, 'tenor')).map(([tenor, tenorRows]) => {
    const best = maxBy(tenorRows, 'totalReturnPct');
    return {
      tenor,
      moneyness_label: best ? best.moneyness_label : null,
      totalReturnPct: best ? best.totalReturnPct : null,
      cagrPct: best ? best.cagrPct : null,
      excessReturnVsBtcPct: best ? best.excessReturnVsBtcPct : null
    };
  }).sort((a, b) => a.tenor.localeCompare(b.tenor));
}

function buildRankings(primaryRows) {
  return {
    best_total_return: rankRows(primaryRows, 'totalReturnPct'),
    best_cagr: rankRows(primaryRows, 'cagrPct'),
    best_excess_vs_btc: rankRows(primaryRows, 'excessReturnVsBtcPct'),
    best_premium_efficiency: rankRows(primaryRows, 'premium_capture_density'),
    best_option_coverage: rankRows(primaryRows, 'observedOptionCoveragePct'),
    best_return_adjusted_by_fallback_usage: rankRows(primaryRows, 'fallback_adjusted_return_score')
  };
}

function detectInconsistencies(rows) {
  const issues = [];
  for (const row of rows) {
    if (row.sample_years === null) {
      issues.push(`${row.source_batch_name}: invalid date range`);
    }
    if (row.cycles_per_year !== null && row.cycles_per_year <= 0) {
      issues.push(`${row.source_batch_name}: non-positive cycles_per_year`);
    }
    if (row.observedOptionCoveragePct !== null) {
      const fallback = row.fallback_penalty_proxy || 0;
      const coverageSum = row.observedOptionCoveragePct + fallback;
      if (coverageSum > 125) {
        issues.push(`${row.source_batch_name}: observed plus fallback coverage is unusually high (${roundNumber(coverageSum, 2)}%)`);
      }
    }
    if (row.totalReturnPct !== null && row.btcReturnPct !== null && row.excessReturnVsBtcPct !== null) {
      const derivedExcess = row.totalReturnPct - row.btcReturnPct;
      if (Math.abs(derivedExcess - row.excessReturnVsBtcPct) > 0.02) {
        issues.push(`${row.source_batch_name}: excess return diverges from totalReturnPct - btcReturnPct`);
      }
    }
  }
  return issues;
}

function describeRow(row) {
  if (!row) return 'n/a';
  return `${row.tenor} ${row.moneyness_label} (${row.totalReturnPct}% total return, ${row.cagrPct}% CAGR)`;
}

function buildInterpretations(primaryRows, tenorSummary, rankings) {
  const bestOverall = rankings.best_total_return[0] || null;
  const bestCagr = rankings.best_cagr[0] || null;
  const bestExcess = rankings.best_excess_vs_btc[0] || null;
  const bestCoverage = rankings.best_option_coverage[0] || null;
  const bestFallbackAdjusted = rankings.best_return_adjusted_by_fallback_usage[0] || null;
  const bestPremium = rankings.best_premium_efficiency[0] || null;
  const tenorLeader = tenorSummary[0] || null;

  return {
    best_overall_tenor: tenorLeader
      ? `${tenorLeader.tenor} leads on average total return across comparable full-period variants.`
      : 'No comparable tenor leader could be determined.',
    best_moneyness_per_tenor: bestMoneynessPerTenor(primaryRows),
    premium_vs_upside_tradeoff: bestPremium
      ? `${bestPremium.tenor} ${bestPremium.moneyness_label} has the strongest net call-PnL density, while ${bestOverall ? `${bestOverall.tenor} ${bestOverall.moneyness_label}` : 'the total-return leader'} best captures upside in total-return terms. Negative premium density means the short call leg was a net drag after settlements.`
      : 'Premium efficiency could not be ranked from available PnL fields.',
    rebalance_frequency_impact: 'cycles_per_year exposes remarking frequency: weekly variants rebalance most often, 14d variants sit in the middle, and monthly variants remark least often. In this sample, lower frequency improved option coverage but did not automatically beat the best upside-preserving 14d/weekly variants.',
    liquidity_fallback_effects: bestCoverage
      ? `${bestCoverage.tenor} ${bestCoverage.moneyness_label} has the highest observed option coverage. Fallback-adjusted rankings penalize theoretical and settlement fallback usage through fallback_penalty_proxy.`
      : 'Coverage metrics were not available.',
    comparison_vs_btc_buy_and_hold: bestExcess
      ? `${bestExcess.tenor} ${bestExcess.moneyness_label} ranks best versus BTC buy-and-hold by excess return. Most variants still trail BTC in total return during this BTC bull-heavy sample.`
      : 'BTC comparison could not be ranked.',
    risk_metric_limitation: 'Drawdown, Sharpe, Sortino, rolling volatility, and worst-cycle metrics remain null because this layer reads consolidated summaries only, not per-run equity curves or trades.'
  };
}

function markdownTable(rows, columns) {
  if (!rows.length) return '';
  const header = `| ${columns.join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`);
  return [header, separator, ...body].join('\n');
}

function buildMarkdown({ generatedAt, rows, validation, rankings, tenorSummary, interpretations }) {
  const inconsistencies = validation.inconsistencies || [];
  const warnings = validation.warnings || [];
  const primaryComparableRowCount = validation.primaryComparableRowCount || 0;
  const rankingRows = Object.entries(rankings).map(([name, values]) => ({
    ranking: name,
    leader: values[0] ? `${values[0].tenor} ${values[0].moneyness_label}` : 'n/a',
    value: values[0] ? values[0].value : null
  }));

  return [
    '# BTC Multi-Tenor Analysis',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Executive Summary',
    '',
    `- Rows analyzed: ${rows.length}; primary comparable rows: ${primaryComparableRowCount}.`,
    `- Best overall tenor: ${interpretations.best_overall_tenor}`,
    `- Best full-period total return: ${rankings.best_total_return[0] ? `${rankings.best_total_return[0].tenor} ${rankings.best_total_return[0].moneyness_label}` : 'n/a'}.`,
    `- BTC comparison: ${interpretations.comparison_vs_btc_buy_and_hold}`,
    `- Risk limitation: ${interpretations.risk_metric_limitation}`,
    '',
    '## Tenor Summary',
    '',
    markdownTable(tenorSummary, [
      'tenor',
      'variantCount',
      'averageTotalReturnPct',
      'averageCagrPct',
      'averageObservedOptionCoveragePct',
      'averageFallbackPenaltyProxy',
      'bestTotalReturnVariant'
    ]),
    '',
    '## Ranking Leaders',
    '',
    markdownTable(rankingRows, ['ranking', 'leader', 'value']),
    '',
    '## Best Moneyness Per Tenor',
    '',
    markdownTable(interpretations.best_moneyness_per_tenor, [
      'tenor',
      'moneyness_label',
      'totalReturnPct',
      'cagrPct',
      'excessReturnVsBtcPct'
    ]),
    '',
    '## Interpretations',
    '',
    `- Premium vs upside tradeoff: ${interpretations.premium_vs_upside_tradeoff}`,
    `- Rebalance frequency impact: ${interpretations.rebalance_frequency_impact}`,
    `- Liquidity/fallback effects: ${interpretations.liquidity_fallback_effects}`,
    `- Comparison versus BTC buy-and-hold: ${interpretations.comparison_vs_btc_buy_and_hold}`,
    '',
    '## Validation',
    '',
    `- Date consistency issues: ${inconsistencies.filter(item => item.includes('date')).length}`,
    `- Detected inconsistencies: ${inconsistencies.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    inconsistencies.length ? inconsistencies.map(item => `- ${item}`).join('\n') : '- No blocking inconsistencies detected.',
    '',
    '## Future-Compatible Analytics',
    '',
    '- Real drawdown analytics: read each run equity curve and compute peak-to-trough drawdown.',
    '- Rolling volatility: calculate rolling return windows from equity curves.',
    '- Equity curve analytics: normalize per-run capital paths and chain yearly segments.',
    '- Monte Carlo simulations: resample cycle returns once per-cycle returns are loaded.',
    '- Regime analysis: tag cycles by BTC trend, realized volatility, and drawdown regime.',
    ''
  ].join('\n');
}

function buildAnalysis() {
  const inputRows = readCsv(INPUT_CSV);
  const rows = inputRows.map(deriveRow);
  const primaryRows = rows.filter(row => row.comparison_scope === 'full_period');
  const rankings = buildRankings(primaryRows);
  const tenorSummary = buildTenorSummary(primaryRows);
  const interpretations = buildInterpretations(primaryRows, tenorSummary, rankings);
  const inconsistencies = detectInconsistencies(rows);
  const warnings = rows.flatMap(row => row.warnings.map(warning => `${row.source_batch_name}: ${warning}`));
  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    input: path.relative(REPO_ROOT, INPUT_CSV),
    outputs: {
      csv: path.relative(REPO_ROOT, OUTPUT_CSV),
      json: path.relative(REPO_ROOT, OUTPUT_JSON),
      markdown: path.relative(REPO_ROOT, OUTPUT_MD)
    },
    methodology: {
      primaryRankingScope: 'Rows with startYear=2020 and endYear=2026 are ranked as the comparable full-period sample.',
      metricDefinitions: {
        return_vs_btc_ratio: 'totalReturnPct / btcReturnPct',
        premium_to_underlying_pnl_ratio: 'totalPnLCall / totalPnLUnderlying',
        annualized_return_per_cycle: 'cagrPct / cycles_per_year',
        excess_return_per_year: 'excessReturnVsBtcPct / sample_years',
        option_coverage_efficiency: 'return_vs_btc_ratio * observedOptionCoveragePct / 100',
        fallback_penalty_proxy: 'theoreticalFallbackCoveragePct + settlementFallbackCoveragePct',
        fallback_adjusted_return_score: 'totalReturnPct * (1 - fallback_penalty_proxy / 100)',
        cycles_per_year: 'totalCycles / sample_years',
        premium_capture_density: 'totalPnLCall / totalCycles',
        underlying_capture_ratio: 'totalPnLUnderlying / totalPnL'
      },
      unavailableRiskMetrics: [
        'maxDrawdownPct',
        'sharpeRatio',
        'sortinoRatio',
        'worstCycleReturnPct'
      ],
      futureArchitecture: [
        'equity_curve_reader',
        'drawdown_analytics',
        'rolling_volatility',
        'monte_carlo_resampling',
        'regime_tagging'
      ]
    },
    validation: {
      rowCount: rows.length,
      primaryComparableRowCount: primaryRows.length,
      tenorsPresent: [...new Set(rows.map(row => row.tenor))].sort(),
      dateConsistencyIssues: inconsistencies.filter(item => item.includes('date')),
      cycleConsistencyIssues: inconsistencies.filter(item => item.includes('cycles')),
      coverageConsistencyIssues: inconsistencies.filter(item => item.includes('coverage')),
      totalRowDivergences: inconsistencies.filter(item => item.includes('excess return diverges')),
      inconsistencies,
      warnings
    },
    tenorSummary,
    rankings,
    interpretations,
    rows
  };
}

function printTerminalSummary(analysis) {
  const bestTotal = analysis.rankings.best_total_return[0];
  const bestCagr = analysis.rankings.best_cagr[0];
  const bestFallbackAdjusted = analysis.rankings.best_return_adjusted_by_fallback_usage[0];

  console.log('\n=== EXECUTIVE SUMMARY ===');
  console.log(`Rows analyzed: ${analysis.validation.rowCount} (${analysis.validation.primaryComparableRowCount} comparable full-period rows)`);
  console.log(`Tenors: ${analysis.validation.tenorsPresent.join(', ')}`);
  console.log(`Best total return: ${bestTotal ? `${bestTotal.tenor} ${bestTotal.moneyness_label} (${bestTotal.value}%)` : 'n/a'}`);
  console.log(`Best CAGR: ${bestCagr ? `${bestCagr.tenor} ${bestCagr.moneyness_label} (${bestCagr.value}%)` : 'n/a'}`);
  console.log(`Best fallback-adjusted return score: ${bestFallbackAdjusted ? `${bestFallbackAdjusted.tenor} ${bestFallbackAdjusted.moneyness_label} (${bestFallbackAdjusted.value})` : 'n/a'}`);

  console.log('\n=== DETECTED INCONSISTENCIES ===');
  if (analysis.validation.inconsistencies.length === 0) {
    console.log('None detected.');
  } else {
    analysis.validation.inconsistencies.forEach(issue => console.log(`- ${issue}`));
  }

  console.log('\n=== WARNINGS ===');
  if (analysis.validation.warnings.length === 0) {
    console.log('None.');
  } else {
    analysis.validation.warnings.forEach(warning => console.log(`- ${warning}`));
  }

  console.log('\n=== SUGGESTED NEXT ANALYTICAL STEPS ===');
  console.log('- Load per-run equity curves to compute real drawdown, rolling volatility, Sharpe, and Sortino.');
  console.log('- Add per-cycle return extraction so Monte Carlo and regime analysis can be built without touching execution logic.');
  console.log('- Separate full-period and partial-period dashboards so short samples do not contaminate rankings.');
}

function main() {
  const analysis = buildAnalysis();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(analysis.rows, ANALYSIS_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(analysis, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(analysis), 'utf8');

  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
  printTerminalSummary(analysis);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC multi-tenor analysis:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildAnalysis,
  deriveRow,
  yearsBetween
};
