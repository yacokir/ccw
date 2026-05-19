const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GENERATED_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const CHART_DIR = path.join(GENERATED_DIR, 'charts');

const TENORS = ['weekly', '14d', 'monthly'];
const REGIMES = ['bull_2020_2021', 'bear_2022', 'recovery_transition_2023', 'etf_bull_2024_2025'];
const MONEYNESS = ['atm00', 'otm03', 'otm05', 'otm07', 'otm10', 'itm05'];

const COLORS = {
  weekly: [43, 111, 173, 255],
  '14d': [58, 150, 118, 255],
  monthly: [204, 124, 55, 255],
  atm00: [76, 99, 130, 255],
  otm03: [58, 150, 118, 255],
  otm05: [229, 179, 75, 255],
  otm07: [204, 124, 55, 255],
  otm10: [190, 73, 73, 255],
  itm05: [123, 92, 167, 255],
  grid: [225, 229, 235, 255],
  axis: [55, 65, 81, 255],
  text: [31, 41, 55, 255],
  muted: [107, 114, 128, 255],
  bg: [255, 255, 255, 255],
  red: [190, 73, 73, 255],
  green: [58, 145, 91, 255],
  yellow: [229, 179, 75, 255],
  blue: [43, 111, 173, 255]
};

const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000']
};

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, name), 'utf8'));
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function finite(values) {
  return values.filter(Number.isFinite);
}

function mean(values) {
  const nums = finite(values);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function min(values) {
  const nums = finite(values);
  return nums.length ? Math.min(...nums) : null;
}

function max(values) {
  const nums = finite(values);
  return nums.length ? Math.max(...nums) : null;
}

function fmt(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function csvValue(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const headers = [
    'row_type', 'asset', 'tenor', 'moneyness_label', 'regime_label',
    'comparison_scope', 'cycleCount', 'meanCycleReturnPct', 'medianCycleReturnPct',
    'stdDevCycleReturnPct', 'interquartileRangePct', 'p01EstimatedCycleReturnPct',
    'p05CycleReturnPct', 'p25CycleReturnPct', 'p75CycleReturnPct',
    'p95CycleReturnPct', 'p99EstimatedCycleReturnPct', 'skewness',
    'excessKurtosis', 'severeLossFrequencyPct', 'extremeUpsideFrequencyPct',
    'tailAsymmetryPct', 'leftTailConcentrationPct', 'rightTailConcentrationPct',
    'dispersionRatio', 'averageRegimeReturnPct', 'averageRegimeVolatilityPct',
    'averageRegimeDrawdownPct', 'averageRegimeHitRatePct', 'notes'
  ];
  const lines = [headers.join(',')];
  rows.forEach(row => lines.push(headers.map(header => csvValue(row[header])).join(',')));
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function parseHistogram(row) {
  const count = optionalNumber(row.histogramBinCount);
  const minValue = optionalNumber(row.histogramMinPct);
  const maxValue = optionalNumber(row.histogramMaxPct);
  const counts = String(row.histogramCounts || '').split('|').map(value => optionalNumber(value) || 0);
  if (!count || minValue === null || maxValue === null || counts.length !== count || maxValue <= minValue) return null;
  const width = (maxValue - minValue) / count;
  return counts.map((binCount, index) => ({
    low: minValue + width * index,
    high: minValue + width * (index + 1),
    mid: minValue + width * (index + 0.5),
    count: binCount
  }));
}

function estimatePercentileFromHistogram(row, percentile) {
  const bins = parseHistogram(row);
  if (!bins) return null;
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (!total) return null;
  const target = total * percentile / 100;
  let cumulative = 0;
  for (const bin of bins) {
    const next = cumulative + bin.count;
    if (target <= next) {
      const inside = bin.count ? (target - cumulative) / bin.count : 0;
      return bin.low + (bin.high - bin.low) * Math.max(0, Math.min(1, inside));
    }
    cumulative = next;
  }
  return bins[bins.length - 1].high;
}

function leftRightConcentration(row) {
  const bins = parseHistogram(row);
  if (!bins) return { left: null, right: null };
  const leftThreshold = optionalNumber(row.severeLossThresholdPct);
  const rightThreshold = optionalNumber(row.cappedUpsideThresholdPct);
  if (leftThreshold === null || rightThreshold === null) return { left: null, right: null };

  let leftMagnitude = 0;
  let allNegativeMagnitude = 0;
  let rightMagnitude = 0;
  let allPositiveMagnitude = 0;

  bins.forEach(bin => {
    if (bin.mid < 0) {
      const magnitude = Math.abs(bin.mid) * bin.count;
      allNegativeMagnitude += magnitude;
      if (bin.mid <= leftThreshold) leftMagnitude += magnitude;
    }
    if (bin.mid > 0) {
      const magnitude = bin.mid * bin.count;
      allPositiveMagnitude += magnitude;
      if (bin.mid >= rightThreshold) rightMagnitude += magnitude;
    }
  });

  return {
    left: allNegativeMagnitude ? leftMagnitude / allNegativeMagnitude * 100 : null,
    right: allPositiveMagnitude ? rightMagnitude / allPositiveMagnitude * 100 : null
  };
}

function groupBy(rows, keyFn) {
  return rows.reduce((groups, row) => {
    const key = keyFn(row);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
    return groups;
  }, {});
}

function aggregateRows(rows, rowType, keys, notes) {
  const first = rows[0] || {};
  return {
    row_type: rowType,
    asset: 'BTC',
    tenor: keys.tenor || '',
    moneyness_label: keys.moneyness_label || '',
    regime_label: keys.regime_label || '',
    comparison_scope: 'full_period',
    cycleCount: fmt(mean(rows.map(row => optionalNumber(row.cycleCount))), 2),
    meanCycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.meanCycleReturnPct)))),
    medianCycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.medianCycleReturnPct)))),
    stdDevCycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.stdDevCycleReturnPct)))),
    interquartileRangePct: fmt(mean(rows.map(row => optionalNumber(row.interquartileRangePct)))),
    p01EstimatedCycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.p01EstimatedCycleReturnPct)))),
    p05CycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.p05CycleReturnPct)))),
    p25CycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.p25CycleReturnPct)))),
    p75CycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.p75CycleReturnPct)))),
    p95CycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.p95CycleReturnPct)))),
    p99EstimatedCycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.p99EstimatedCycleReturnPct)))),
    skewness: fmt(mean(rows.map(row => optionalNumber(row.skewness)))),
    excessKurtosis: fmt(mean(rows.map(row => optionalNumber(row.excessKurtosis)))),
    severeLossFrequencyPct: fmt(mean(rows.map(row => optionalNumber(row.severeLossFrequencyPct)))),
    extremeUpsideFrequencyPct: fmt(mean(rows.map(row => optionalNumber(row.extremeUpsideFrequencyPct)))),
    tailAsymmetryPct: fmt(mean(rows.map(row => optionalNumber(row.tailAsymmetryPct)))),
    leftTailConcentrationPct: fmt(mean(rows.map(row => optionalNumber(row.leftTailConcentrationPct)))),
    rightTailConcentrationPct: fmt(mean(rows.map(row => optionalNumber(row.rightTailConcentrationPct)))),
    dispersionRatio: fmt(mean(rows.map(row => optionalNumber(row.dispersionRatio)))),
    averageRegimeReturnPct: '',
    averageRegimeVolatilityPct: '',
    averageRegimeDrawdownPct: '',
    averageRegimeHitRatePct: '',
    notes: notes || first.notes || ''
  };
}

function buildDistributionRows(distribution, regime) {
  const fullRows = distribution.rows.filter(row => row.comparison_scope === 'full_period');
  const strategyRows = fullRows.map(row => {
    const concentrations = leftRightConcentration(row);
    const severeLossFrequency = optionalNumber(row.severeLossFrequencyPct);
    const extremeUpsideFrequency = optionalNumber(row.cappedUpsideFrequencyPct);
    const iqr = optionalNumber(row.interquartileRangePct);
    const std = optionalNumber(row.stdDevCycleReturnPct);
    return {
      row_type: 'strategy',
      asset: row.asset,
      tenor: row.tenor,
      moneyness_label: row.moneyness_label,
      regime_label: '',
      comparison_scope: row.comparison_scope,
      cycleCount: optionalNumber(row.cycleCount),
      meanCycleReturnPct: optionalNumber(row.meanCycleReturnPct),
      medianCycleReturnPct: optionalNumber(row.medianCycleReturnPct),
      stdDevCycleReturnPct: optionalNumber(row.stdDevCycleReturnPct),
      interquartileRangePct: optionalNumber(row.interquartileRangePct),
      p01EstimatedCycleReturnPct: fmt(estimatePercentileFromHistogram(row, 1)),
      p05CycleReturnPct: optionalNumber(row.p05CycleReturnPct),
      p25CycleReturnPct: optionalNumber(row.p25CycleReturnPct),
      p75CycleReturnPct: optionalNumber(row.p75CycleReturnPct),
      p95CycleReturnPct: optionalNumber(row.p95CycleReturnPct),
      p99EstimatedCycleReturnPct: fmt(estimatePercentileFromHistogram(row, 99)),
      skewness: optionalNumber(row.skewness),
      excessKurtosis: optionalNumber(row.excessKurtosis),
      severeLossFrequencyPct: severeLossFrequency,
      extremeUpsideFrequencyPct: extremeUpsideFrequency,
      tailAsymmetryPct: severeLossFrequency !== null && extremeUpsideFrequency !== null ? fmt(extremeUpsideFrequency - severeLossFrequency) : null,
      leftTailConcentrationPct: optionalNumber(row.tailConcentrationPct),
      rightTailConcentrationPct: fmt(concentrations.right),
      dispersionRatio: std !== null && iqr ? fmt(std / iqr) : null,
      averageRegimeReturnPct: '',
      averageRegimeVolatilityPct: '',
      averageRegimeDrawdownPct: '',
      averageRegimeHitRatePct: '',
      notes: 'Cycle-based distribution row; p01/p99 are estimated from stored histogram bins.'
    };
  });

  const tenorRows = Object.entries(groupBy(strategyRows, row => row.tenor))
    .map(([tenor, rows]) => aggregateRows(rows, 'tenor_summary', { tenor }, 'Average across full-period moneyness variants.'));

  const moneynessRows = Object.entries(groupBy(strategyRows, row => row.moneyness_label))
    .map(([moneyness, rows]) => aggregateRows(rows, 'moneyness_summary', { moneyness_label: moneyness }, 'Average across tenors where this moneyness exists.'));

  const regimeFull = regime.rows.filter(row => row.comparison_scope === 'full_period');
  const regimeRows = Object.entries(groupBy(regimeFull, row => `${row.tenor}|${row.regime_label}`)).map(([key, rows]) => {
    const [tenor, regimeLabel] = key.split('|');
    return {
      row_type: 'regime_summary',
      asset: 'BTC',
      tenor,
      moneyness_label: '',
      regime_label: regimeLabel,
      comparison_scope: 'full_period',
      cycleCount: fmt(mean(rows.map(row => optionalNumber(row.cycleCount))), 2),
      meanCycleReturnPct: fmt(mean(rows.map(row => optionalNumber(row.averageCycleReturnPct)))),
      medianCycleReturnPct: '',
      stdDevCycleReturnPct: '',
      interquartileRangePct: '',
      p01EstimatedCycleReturnPct: '',
      p05CycleReturnPct: '',
      p25CycleReturnPct: '',
      p75CycleReturnPct: '',
      p95CycleReturnPct: '',
      p99EstimatedCycleReturnPct: '',
      skewness: '',
      excessKurtosis: '',
      severeLossFrequencyPct: '',
      extremeUpsideFrequencyPct: '',
      tailAsymmetryPct: '',
      leftTailConcentrationPct: '',
      rightTailConcentrationPct: '',
      dispersionRatio: '',
      averageRegimeReturnPct: fmt(mean(rows.map(row => optionalNumber(row.returnPct)))),
      averageRegimeVolatilityPct: fmt(mean(rows.map(row => optionalNumber(row.volatilityPct)))),
      averageRegimeDrawdownPct: fmt(mean(rows.map(row => optionalNumber(row.drawdownPct)))),
      averageRegimeHitRatePct: fmt(mean(rows.map(row => optionalNumber(row.hitRatePct)))),
      notes: 'Regime-conditioned proxy row; source regime output does not include full percentile/skew/kurtosis distribution fields.'
    };
  });

  return [...strategyRows, ...tenorRows, ...moneynessRows, ...regimeRows];
}

function findLeader(rows, field, mode = 'max') {
  const candidates = rows.filter(row => Number.isFinite(optionalNumber(row[field])));
  candidates.sort((a, b) => optionalNumber(a[field]) - optionalNumber(b[field]));
  return mode === 'min' ? candidates[0] : candidates[candidates.length - 1];
}

function buildFindings(rows) {
  const strategy = rows.filter(row => row.row_type === 'strategy');
  const tenors = rows.filter(row => row.row_type === 'tenor_summary');
  const regimes = rows.filter(row => row.row_type === 'regime_summary');
  const widthLeader = findLeader(tenors, 'stdDevCycleReturnPct', 'max');
  const widthLow = findLeader(tenors, 'stdDevCycleReturnPct', 'min');
  const kurtosisLeader = findLeader(tenors, 'excessKurtosis', 'max');
  const skewHigh = findLeader(tenors, 'skewness', 'max');
  const skewLow = findLeader(tenors, 'skewness', 'min');
  const leftTailLeader = findLeader(tenors, 'leftTailConcentrationPct', 'max');
  const rightTailLeader = findLeader(tenors, 'rightTailConcentrationPct', 'max');
  const severeLeader = findLeader(tenors, 'severeLossFrequencyPct', 'max');
  const bearDrawdown = regimes.filter(row => row.regime_label === 'bear_2022');
  const bearWorstDrawdown = findLeader(bearDrawdown, 'averageRegimeDrawdownPct', 'min');
  const bearVolLeader = findLeader(bearDrawdown, 'averageRegimeVolatilityPct', 'max');
  const otm10 = strategy.filter(row => row.moneyness_label === 'otm10');
  const otm10Skew = mean(otm10.map(row => optionalNumber(row.skewness)));

  return {
    observations: [
      `${widthLeader.tenor} has the widest average cycle-return dispersion by standard deviation (${fmt(optionalNumber(widthLeader.stdDevCycleReturnPct), 3)} pp), while ${widthLow.tenor} has the narrowest (${fmt(optionalNumber(widthLow.stdDevCycleReturnPct), 3)} pp).`,
      `${kurtosisLeader.tenor} has the highest average excess kurtosis (${fmt(optionalNumber(kurtosisLeader.excessKurtosis), 3)}), indicating the strongest fat-tail signal in the cycle-based distribution layer.`,
      `Average skewness is most negative for ${skewLow.tenor} (${fmt(optionalNumber(skewLow.skewness), 3)}) and least negative for ${skewHigh.tenor} (${fmt(optionalNumber(skewHigh.skewness), 3)}).`,
      `${leftTailLeader.tenor} has the highest average left-tail concentration (${fmt(optionalNumber(leftTailLeader.leftTailConcentrationPct), 3)}%), while ${rightTailLeader.tenor} has the highest estimated right-tail concentration (${fmt(optionalNumber(rightTailLeader.rightTailConcentrationPct), 3)}%).`,
      `${severeLeader.tenor} has the highest average severe-loss frequency (${fmt(optionalNumber(severeLeader.severeLossFrequencyPct), 3)}%).`,
      `In the regime proxy layer, ${bearVolLeader.tenor} has the highest average 2022 bear volatility (${fmt(optionalNumber(bearVolLeader.averageRegimeVolatilityPct), 3)} pp), and ${bearWorstDrawdown.tenor} has the deepest average 2022 bear drawdown (${fmt(optionalNumber(bearWorstDrawdown.averageRegimeDrawdownPct), 3)}%).`
    ],
    interpretations: [
      'Weekly and 14d distributions should be compared as cycle-based distributions, not annualized risk distributions.',
      'Negative skewness across tenor summaries indicates that adverse cycle outcomes are larger or more concentrated than upside cycle outcomes in the current reconstructed return sample.',
      'High excess kurtosis and left-tail concentration indicate that a small number of adverse cycles contribute disproportionately to negative-return magnitude.'
    ],
    hypotheses: [
      `14d may smooth some distribution shape metrics relative to weekly/monthly, but the evidence is mixed and should not be treated as proof until annualized and intracycle metrics are added.`,
      `OTM10 has average skewness of ${fmt(otm10Skew, 3)} across tenors, suggesting wider strikes change upside participation but do not eliminate left-tail asymmetry in the current cycle-return sample.`,
      'Monthly may behave like compressed carry in some views because it has fewer, longer cycles; this requires tenor-normalized volatility and tail metrics before becoming a formal conclusion.',
      'The 2022 bear regime appears to intensify downside clustering in regime proxy metrics, but current regime outputs do not contain true regime-conditioned percentiles or skew/kurtosis.'
    ]
  };
}

function buildMarkdown(rows, findings) {
  const tenorRows = rows.filter(row => row.row_type === 'tenor_summary')
    .sort((a, b) => TENORS.indexOf(a.tenor) - TENORS.indexOf(b.tenor));
  const regimeRows = rows.filter(row => row.row_type === 'regime_summary')
    .sort((a, b) => TENORS.indexOf(a.tenor) - TENORS.indexOf(b.tenor) || REGIMES.indexOf(a.regime_label) - REGIMES.indexOf(b.regime_label));

  return [
    '# BTC Cycle-Return Distribution Findings',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Methodology',
    '',
    '- Reads existing generated outputs only: `btc_cycle_distribution_analysis`, `btc_regime_analysis`, and `btc_equity_risk_analysis`.',
    '- Distribution metrics are cycle-based and are not annualized.',
    '- p5, p25, median, p75, and p95 come from the source cycle-distribution artifact.',
    '- p1 and p99 are estimated from stored histogram bins because raw per-cycle returns are not present in the generated distribution artifact.',
    '- Regime-conditioned rows use regime-level proxy metrics because the current regime artifact does not include regime-conditioned percentiles, skewness, or kurtosis.',
    '',
    '## Tenor Summary',
    '',
    '| tenor | meanCycleReturnPct | stdDevCycleReturnPct | p01Est | p05 | median | p95 | p99Est | skewness | excessKurtosis | severeLossFrequencyPct | leftTailConcentrationPct |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...tenorRows.map(row => `| ${row.tenor} | ${row.meanCycleReturnPct} | ${row.stdDevCycleReturnPct} | ${row.p01EstimatedCycleReturnPct} | ${row.p05CycleReturnPct} | ${row.medianCycleReturnPct} | ${row.p95CycleReturnPct} | ${row.p99EstimatedCycleReturnPct} | ${row.skewness} | ${row.excessKurtosis} | ${row.severeLossFrequencyPct} | ${row.leftTailConcentrationPct} |`),
    '',
    '## Observations',
    '',
    ...findings.observations.map(item => `- ${item}`),
    '',
    '## Interpretations',
    '',
    ...findings.interpretations.map(item => `- ${item}`),
    '',
    '## Hypotheses',
    '',
    ...findings.hypotheses.map(item => `- ${item}`),
    '',
    '## Regime Proxy Summary',
    '',
    '| tenor | regime | avgReturnPct | avgVolatilityPct | avgDrawdownPct | avgHitRatePct |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...regimeRows.map(row => `| ${row.tenor} | ${row.regime_label} | ${row.averageRegimeReturnPct} | ${row.averageRegimeVolatilityPct} | ${row.averageRegimeDrawdownPct} | ${row.averageRegimeHitRatePct} |`),
    '',
    '## Limitations',
    '',
    '- Cycle-return distributions are not annualized and are not directly comparable to annual volatility.',
    '- Tenors have different cycle lengths and cycle counts.',
    '- Histogram-derived p1/p99 values are estimates, not exact percentiles.',
    '- Current regime-conditioned distribution analysis is proxy-based; true regime percentiles require per-cycle regime-tagged rows.',
    '- No intracycle mark-to-market distribution is modeled.',
    '- No fees, slippage, funding, or execution-friction distributions are included.',
    ''
  ].join('\n');
}

function createCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = COLORS.bg[0];
    data[i + 1] = COLORS.bg[1];
    data[i + 2] = COLORS.bg[2];
    data[i + 3] = 255;
  }
  return { width, height, data };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = color[3] ?? 255;
}

function fillRect(canvas, x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + w));
  const y1 = Math.min(canvas.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    let index = (py * canvas.width + x0) * 4;
    for (let px = x0; px < x1; px++) {
      canvas.data[index] = color[0];
      canvas.data[index + 1] = color[1];
      canvas.data[index + 2] = color[2];
      canvas.data[index + 3] = color[3] ?? 255;
      index += 4;
    }
  }
}

function drawLine(canvas, x0, y0, x1, y1, color) {
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const sx = Math.round(x0);
  const sy = Math.round(y0);
  const ex = Math.round(x1);
  const ey = Math.round(y1);
  const steps = Math.max(Math.abs(ex - sx), Math.abs(ey - sy));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    setPixel(canvas, Math.round(sx + (ex - sx) * t), Math.round(sy + (ey - sy) * t), color);
  }
}

function drawText(canvas, text, x, y, color = COLORS.text, scale = 2) {
  let cursor = x;
  for (const char of String(text).toUpperCase()) {
    const glyph = FONT[char] || FONT[' '];
    glyph.forEach((line, gy) => {
      [...line].forEach((bit, gx) => {
        if (bit === '1') fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, color);
      });
    });
    cursor += 6 * scale;
  }
}

function drawTitle(canvas, title, subtitle) {
  drawText(canvas, title, 34, 24, COLORS.text, 3);
  if (subtitle) drawText(canvas, subtitle, 36, 56, COLORS.muted, 2);
}

function drawAxes(canvas, plot, yMin, yMax, yLabel) {
  fillRect(canvas, plot.x, plot.y, 1, plot.h, COLORS.axis);
  fillRect(canvas, plot.x, plot.y + plot.h, plot.w, 1, COLORS.axis);
  for (let i = 0; i <= 4; i++) {
    const y = plot.y + plot.h - plot.h * i / 4;
    drawLine(canvas, plot.x, y, plot.x + plot.w, y, COLORS.grid);
    const value = yMin + (yMax - yMin) * i / 4;
    drawText(canvas, value.toFixed(0), 10, y - 7, COLORS.muted, 2);
  }
  if (yLabel) drawText(canvas, yLabel, plot.x, plot.y - 20, COLORS.muted, 2);
}

function scaleY(value, plot, yMin, yMax) {
  if (yMax === yMin) return plot.y + plot.h / 2;
  return plot.y + plot.h - ((value - yMin) / (yMax - yMin)) * plot.h;
}

function scaleX(value, plot, xMin, xMax) {
  if (xMax === xMin) return plot.x + plot.w / 2;
  return plot.x + ((value - xMin) / (xMax - xMin)) * plot.w;
}

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(canvas, output) {
  const raw = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    raw[y * (canvas.width * 4 + 1)] = 0;
    canvas.data.copy(raw, y * (canvas.width * 4 + 1) + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(output, png);
}

function drawLegend(canvas, items, x, y) {
  items.forEach(([key, label], index) => {
    fillRect(canvas, x + index * 120, y, 18, 18, COLORS[key] || COLORS.axis);
    drawText(canvas, label, x + 24 + index * 120, y + 2, COLORS.text, 2);
  });
}

function aggregateHistogram(sourceRows, groupField, groupValues) {
  const globalMin = min(sourceRows.map(row => optionalNumber(row.histogramMinPct)));
  const globalMax = max(sourceRows.map(row => optionalNumber(row.histogramMaxPct)));
  const binCount = 12;
  const width = (globalMax - globalMin) / binCount;
  return groupValues.map(group => {
    const counts = Array(binCount).fill(0);
    sourceRows.filter(row => row[groupField] === group).forEach(row => {
      const bins = parseHistogram(row) || [];
      bins.forEach(bin => {
        const index = Math.max(0, Math.min(binCount - 1, Math.floor((bin.mid - globalMin) / width)));
        counts[index] += bin.count;
      });
    });
    const total = counts.reduce((sum, value) => sum + value, 0);
    return { group, counts: total ? counts.map(value => value / total * 100) : counts, globalMin, globalMax };
  });
}

function histogramChart({ title, subtitle, histograms, output, legendItems, legendX = 520, legendY = 28 }) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 78, y: 108, w: 980, h: 430 };
  const maxValue = max(histograms.flatMap(row => row.counts)) || 1;
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, 0, maxValue * 1.15, 'FREQ %');
  const binCount = histograms[0].counts.length;
  const binW = plot.w / binCount;
  const barW = Math.max(4, binW / (histograms.length + 1));
  histograms.forEach((hist, groupIndex) => {
    hist.counts.forEach((value, binIndex) => {
      const x = plot.x + binIndex * binW + groupIndex * barW + 2;
      const y = scaleY(value, plot, 0, maxValue * 1.15);
      fillRect(canvas, x, y, barW - 2, plot.y + plot.h - y, COLORS[hist.group] || COLORS.axis);
    });
  });
  drawText(canvas, histograms[0].globalMin.toFixed(0), plot.x, plot.y + plot.h + 14, COLORS.muted, 2);
  drawText(canvas, histograms[0].globalMax.toFixed(0), plot.x + plot.w - 36, plot.y + plot.h + 14, COLORS.muted, 2);
  drawLegend(canvas, legendItems, legendX, legendY);
  writePng(canvas, output);
}

function percentileChart(rows, output) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 82, y: 112, w: 960, h: 420 };
  const fields = ['p01EstimatedCycleReturnPct', 'p05CycleReturnPct', 'p25CycleReturnPct', 'medianCycleReturnPct', 'p75CycleReturnPct', 'p95CycleReturnPct', 'p99EstimatedCycleReturnPct'];
  const labels = ['P1', 'P5', 'P25', 'MED', 'P75', 'P95', 'P99'];
  const values = rows.flatMap(row => fields.map(field => optionalNumber(row[field]))).filter(Number.isFinite);
  const yMin = Math.min(...values, 0);
  const yMax = Math.max(...values, 1);
  drawTitle(canvas, 'BTC DISTRIBUTION PERCENTILES', 'CYCLE RETURN P1/P99 ESTIMATED FROM HISTOGRAMS');
  drawAxes(canvas, plot, yMin, yMax, 'RETURN %');
  rows.forEach(row => {
    let prev = null;
    fields.forEach((field, index) => {
      const value = optionalNumber(row[field]);
      const x = plot.x + index * plot.w / (fields.length - 1);
      const y = scaleY(value, plot, yMin, yMax);
      fillRect(canvas, x - 3, y - 3, 6, 6, COLORS[row.tenor]);
      if (prev) drawLine(canvas, prev.x, prev.y, x, y, COLORS[row.tenor]);
      prev = { x, y };
    });
  });
  labels.forEach((label, index) => drawText(canvas, label, plot.x + index * plot.w / (labels.length - 1) - 12, plot.y + plot.h + 16, COLORS.muted, 2));
  drawLegend(canvas, TENORS.map(tenor => [tenor, tenor.toUpperCase()]), 650, 28);
  writePng(canvas, output);
}

function groupedMetricChart({ title, subtitle, rows, fields, labels, output, yMin = null, yLabel = '%' }) {
  const canvas = createCanvas(1100, 680);
  const plot = { x: 82, y: 112, w: 960, h: 420 };
  const values = rows.flatMap(row => fields.map(field => optionalNumber(row[field]))).filter(Number.isFinite);
  const minValue = yMin === null ? Math.min(...values, 0) : yMin;
  const maxValue = Math.max(...values, 1);
  drawTitle(canvas, title, subtitle);
  drawAxes(canvas, plot, minValue, maxValue * 1.15, yLabel);
  const groupW = plot.w / rows.length;
  rows.forEach((row, rowIndex) => {
    fields.forEach((field, fieldIndex) => {
      const value = optionalNumber(row[field]);
      const barW = Math.max(12, groupW / (fields.length + 2));
      const x = plot.x + rowIndex * groupW + 12 + fieldIndex * (barW + 8);
      const y0 = scaleY(0, plot, minValue, maxValue * 1.15);
      const y = scaleY(value, plot, minValue, maxValue * 1.15);
      fillRect(canvas, x, Math.min(y, y0), barW, Math.abs(y0 - y), fieldIndex === 0 ? COLORS.blue : COLORS.red);
    });
    drawText(canvas, row.tenor || row.moneyness_label, plot.x + rowIndex * groupW + 8, plot.y + plot.h + 16, COLORS.muted, 2);
  });
  drawLegend(canvas, fields.map((field, i) => [i === 0 ? 'blue' : 'red', labels[i]]), 620, 28);
  writePng(canvas, output);
}

function heatColor(value, minValue, maxValue) {
  if (maxValue === minValue) return COLORS.yellow;
  const t = (value - minValue) / (maxValue - minValue);
  const r = Math.round(190 * (1 - t) + 58 * t);
  const g = Math.round(73 * (1 - t) + 145 * t);
  const b = Math.round(73 * (1 - t) + 91 * t);
  return [r, g, b, 255];
}

function regimeHeatmap(rows, output) {
  const canvas = createCanvas(1100, 680);
  drawTitle(canvas, 'BTC REGIME DISTRIBUTION PROXY', 'AVERAGE CYCLE RETURN BY TENOR AND REGIME');
  const values = rows.map(row => optionalNumber(row.meanCycleReturnPct)).filter(Number.isFinite);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const x0 = 220;
  const y0 = 140;
  const cellW = 195;
  const cellH = 110;
  REGIMES.forEach((regime, i) => drawText(canvas, regime.replace(/_/g, ' '), x0 + i * cellW + 6, y0 - 36, COLORS.text, 1));
  TENORS.forEach((tenor, i) => drawText(canvas, tenor, 90, y0 + i * cellH + 44, COLORS.text, 2));
  TENORS.forEach((tenor, yIndex) => {
    REGIMES.forEach((regime, xIndex) => {
      const row = rows.find(item => item.tenor === tenor && item.regime_label === regime);
      const value = row ? optionalNumber(row.meanCycleReturnPct) : null;
      const x = x0 + xIndex * cellW;
      const y = y0 + yIndex * cellH;
      fillRect(canvas, x, y, cellW - 8, cellH - 8, value === null ? COLORS.grid : heatColor(value, minValue, maxValue));
      drawText(canvas, value === null ? 'NA' : value.toFixed(1), x + 64, y + 42, [255, 255, 255, 255], 2);
    });
  });
  writePng(canvas, output);
}

function buildCharts(sourceDistributionRows, rows) {
  fs.mkdirSync(CHART_DIR, { recursive: true });
  const fullSource = sourceDistributionRows.filter(row => row.comparison_scope === 'full_period');
  const tenorRows = rows.filter(row => row.row_type === 'tenor_summary')
    .sort((a, b) => TENORS.indexOf(a.tenor) - TENORS.indexOf(b.tenor));
  const moneynessRows = rows.filter(row => row.row_type === 'moneyness_summary')
    .filter(row => MONEYNESS.includes(row.moneyness_label))
    .sort((a, b) => MONEYNESS.indexOf(a.moneyness_label) - MONEYNESS.indexOf(b.moneyness_label));
  const regimeRows = rows.filter(row => row.row_type === 'regime_summary');

  const charts = [
    {
      file: 'btc_distribution_histogram_by_tenor.png',
      title: 'Cycle-Return Histogram By Tenor',
      represents: 'Approximate cycle-return histogram frequency by tenor, aggregated from stored histogram bins.',
      interpretation: 'Compares distribution mass across cycle-return ranges; bins are approximated from existing generated histogram counts.',
      write: output => histogramChart({
        title: 'BTC CYCLE HISTOGRAM BY TENOR',
        subtitle: 'APPROX FREQUENCY FROM STORED HISTOGRAM BINS',
        histograms: aggregateHistogram(fullSource, 'tenor', TENORS),
        legendItems: TENORS.map(tenor => [tenor, tenor.toUpperCase()]),
        output
      })
    },
    {
      file: 'btc_distribution_histogram_by_moneyness.png',
      title: 'Cycle-Return Histogram By Moneyness',
      represents: 'Approximate cycle-return histogram frequency by moneyness, aggregated across available tenors.',
      interpretation: 'Compares how strike distance shifts distribution mass; available moneyness coverage differs by tenor.',
      write: output => histogramChart({
        title: 'BTC CYCLE HISTOGRAM BY MONEYNESS',
        subtitle: 'APPROX FREQUENCY AGGREGATED ACROSS TENORS',
        histograms: aggregateHistogram(fullSource, 'moneyness_label', MONEYNESS.filter(m => fullSource.some(row => row.moneyness_label === m))),
        legendItems: MONEYNESS.filter(m => fullSource.some(row => row.moneyness_label === m)).map(m => [m, m.toUpperCase()]),
        legendX: 320,
        legendY: 74,
        output
      })
    },
    {
      file: 'btc_distribution_percentiles.png',
      title: 'Cycle-Return Percentiles',
      represents: 'Tenor-level average p1, p5, p25, median, p75, p95, and p99 cycle-return structure.',
      interpretation: 'Shows left and right tail shape by tenor; p1 and p99 are estimated from stored histogram bins.',
      write: output => percentileChart(tenorRows, output)
    },
    {
      file: 'btc_distribution_shape_metrics.png',
      title: 'Skewness And Kurtosis Comparison',
      represents: 'Tenor-level average cycle-return skewness and excess kurtosis.',
      interpretation: 'Negative skewness indicates left-tail asymmetry; high excess kurtosis indicates fat-tailed cycle returns.',
      write: output => groupedMetricChart({
        title: 'BTC SHAPE METRICS',
        subtitle: 'CYCLE SKEWNESS AND EXCESS KURTOSIS',
        rows: tenorRows,
        fields: ['skewness', 'excessKurtosis'],
        labels: ['SKEW', 'KURT'],
        yLabel: 'RATIO',
        output
      })
    },
    {
      file: 'btc_distribution_tail_frequency.png',
      title: 'Tail-Frequency Comparison',
      represents: 'Tenor-level average severe-loss and extreme-upside cycle frequencies.',
      interpretation: 'Compares how often cycles fall into left-tail or right-tail flags defined by the source distribution artifact.',
      write: output => groupedMetricChart({
        title: 'BTC TAIL FREQUENCY',
        subtitle: 'SEVERE LOSS VS EXTREME UPSIDE CYCLE FREQUENCY',
        rows: tenorRows,
        fields: ['severeLossFrequencyPct', 'extremeUpsideFrequencyPct'],
        labels: ['LOSS', 'UPSIDE'],
        output,
        yMin: 0
      })
    },
    {
      file: 'btc_distribution_regime_heatmap.png',
      title: 'Regime-Conditioned Distribution Heatmap',
      represents: 'Regime proxy view using average cycle return by tenor and deterministic calendar regime.',
      interpretation: 'Shows regime-conditioned cycle-return tendency; current regime artifact does not include true regime percentiles/skew/kurtosis.',
      write: output => regimeHeatmap(regimeRows, output)
    }
  ];

  charts.forEach(chart => chart.write(path.join(CHART_DIR, chart.file)));
  return charts.map(({ write, ...chart }) => chart);
}

function updateVisualizationIndex(charts) {
  const indexPath = path.join(CHART_DIR, 'btc_visualization_index.md');
  const existing = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '# BTC Visualization Index\n\n';
  const marker = '## Distribution Charts';
  const base = existing.includes(marker) ? existing.slice(0, existing.indexOf(marker)).trimEnd() : existing.trimEnd();
  const section = [
    '',
    marker,
    '',
    'Distribution charts are generated from existing cycle-distribution, regime, and equity-risk artifacts. Metrics are cycle-based and are not annualized.',
    '',
    ...charts.map(chart => [
      `### ${chart.title}`,
      '',
      `- File: [${chart.file}](./${chart.file})`,
      `- Represents: ${chart.represents}`,
      `- Interpretation: ${chart.interpretation}`,
      ''
    ].join('\n')),
    '### Distribution Metric Caveats',
    '',
    '- p1 and p99 are estimated from stored histogram bins because the generated distribution artifact does not contain raw cycle returns.',
    '- Histogram charts are approximate aggregations from per-strategy histogram bins.',
    '- Regime-conditioned distribution heatmap uses regime proxy metrics; true regime percentiles, skewness, and kurtosis require per-cycle regime-tagged rows.',
    '- Tail frequencies and concentration metrics are cycle-based and should not be interpreted as annualized risk.',
    ''
  ].join('\n');
  fs.writeFileSync(indexPath, `${base}\n${section}`, 'utf8');
}

function main() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.mkdirSync(CHART_DIR, { recursive: true });

  const distribution = readJson('btc_cycle_distribution_analysis.json');
  const regime = readJson('btc_regime_analysis.json');
  const equity = readJson('btc_equity_risk_analysis.json');

  const rows = buildDistributionRows(distribution, regime);
  const findings = buildFindings(rows);
  const charts = buildCharts(distribution.rows, rows);

  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    inputs: {
      cycleDistribution: 'analysis/generated/btc_cycle_distribution_analysis.json',
      regime: 'analysis/generated/btc_regime_analysis.json',
      equityRisk: 'analysis/generated/btc_equity_risk_analysis.json'
    },
    methodology: {
      source: 'Existing generated BTC analysis artifacts only; no backtests or batch outputs are regenerated.',
      p01p99: 'Estimated from stored histogram bins because raw per-cycle returns are not present in the generated distribution artifact.',
      regimeConditioning: 'Uses regime-level proxy metrics from btc_regime_analysis; current regime artifact does not include full regime-conditioned percentiles/skew/kurtosis.',
      units: 'All distribution metrics are cycle-based percentage-point metrics unless noted otherwise.'
    },
    validation: {
      rowCount: rows.length,
      strategyRowCount: rows.filter(row => row.row_type === 'strategy').length,
      tenorsPresent: TENORS.filter(tenor => rows.some(row => row.tenor === tenor)),
      moneynessPresent: MONEYNESS.filter(moneyness => rows.some(row => row.moneyness_label === moneyness)),
      equityRiskRowsRead: Array.isArray(equity.rows) ? equity.rows.length : 0,
      charts: charts.map(chart => path.join('analysis', 'generated', 'charts', chart.file))
    },
    findings,
    rows
  };

  fs.writeFileSync(path.join(GENERATED_DIR, 'btc_distribution_findings.json'), JSON.stringify(jsonOutput, null, 2), 'utf8');
  writeCsv(path.join(GENERATED_DIR, 'btc_distribution_findings.csv'), rows);
  fs.writeFileSync(path.join(GENERATED_DIR, 'btc_distribution_findings.md'), buildMarkdown(rows, findings), 'utf8');
  updateVisualizationIndex(charts);

  console.log(`Wrote ${path.join('analysis', 'generated', 'btc_distribution_findings.json')}`);
  console.log(`Wrote ${path.join('analysis', 'generated', 'btc_distribution_findings.csv')}`);
  console.log(`Wrote ${path.join('analysis', 'generated', 'btc_distribution_findings.md')}`);
  charts.forEach(chart => console.log(`Wrote ${path.join('analysis', 'generated', 'charts', chart.file)}`));
  console.log(`Updated ${path.join('analysis', 'generated', 'charts', 'btc_visualization_index.md')}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error building BTC distribution findings:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main
};
