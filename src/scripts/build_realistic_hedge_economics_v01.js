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
const BYBIT_FUNDING_URL = 'https://api.bybit.com/v5/market/funding/history';
const BYBIT_SYMBOL = 'BTCUSDT';
const FUNDING_START_MS = Date.parse('2020-01-01T00:00:00Z');
const FUNDING_END_MS = Date.parse('2026-01-01T00:00:00Z') - 1;
const STATES = ['normal', 'watch', 'stress', 'crisis'];
const RANK = Object.fromEntries(STATES.map((state, index) => [state, index]));

const POLICIES = [
  { policyId: 'stress30_crisis40', stressHedgePct: 30, crisisHedgePct: 40 },
  { policyId: 'stress25_crisis50', stressHedgePct: 25, crisisHedgePct: 50 }
];

const ECONOMIC_SCENARIOS = [
  {
    scenarioId: 'BASE',
    takerFee: 0.00055,
    slippage: 0.0002,
    fundingMode: 'historical_or_zero',
    fundingProxyDaily: 0,
    basisDaily: 0,
    collateralEffectDaily: 0,
    leverage: 3
  },
  {
    scenarioId: 'CONSERVATIVE',
    takerFee: 0.00055,
    slippage: 0.0005,
    fundingMode: 'adverse_proxy',
    fundingProxyDaily: -0.0002,
    basisDaily: -0.0001,
    collateralEffectDaily: 0,
    leverage: 2
  },
  {
    scenarioId: 'STRESS',
    takerFee: 0.00055,
    slippage: 0.001,
    fundingMode: 'adverse_proxy',
    fundingProxyDaily: -0.0005,
    basisDaily: -0.0003,
    collateralEffectDaily: 0.00005,
    leverage: 1
  }
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
const OUTPUT_DIR_V01 = path.join(OUTPUT_DIR, 'daily_mtm', 'hedge_economics_v01');

const OUTPUT_ASSUMPTIONS_JSON = path.join(OUTPUT_DIR_V01, 'assumptions.json');
const OUTPUT_DAILY_CSV = path.join(OUTPUT_DIR_V01, 'daily_series.csv');
const OUTPUT_DAILY_JSON = path.join(OUTPUT_DIR_V01, 'daily_series.json');
const OUTPUT_SCENARIO_CSV = path.join(OUTPUT_DIR_V01, 'scenario_summary.csv');
const OUTPUT_SCENARIO_JSON = path.join(OUTPUT_DIR_V01, 'scenario_summary.json');
const OUTPUT_YEARLY_CSV = path.join(OUTPUT_DIR_V01, 'yearly_summary.csv');
const OUTPUT_YEARLY_JSON = path.join(OUTPUT_DIR_V01, 'yearly_summary.json');
const OUTPUT_COMPARISON_CSV = path.join(OUTPUT_DIR_V01, 'comparison_summary.csv');
const OUTPUT_COMPARISON_JSON = path.join(OUTPUT_DIR_V01, 'comparison_summary.json');
const OUTPUT_FINDINGS_MD = path.join(OUTPUT_DIR_V01, 'findings.md');
const OUTPUT_FUNDING_CSV = path.join(OUTPUT_DIR_V01, 'bybit_btcusdt_funding_history.csv');
const OUTPUT_FUNDING_JSON = path.join(OUTPUT_DIR_V01, 'bybit_btcusdt_funding_history.json');

const DAILY_COLUMNS = [
  'date', 'year', 'regime', 'policyId', 'economicScenarioId',
  'source_alert_state', 'applied_alert_state', 'hedge_ratio',
  'ccw_daily_return_pct', 'underlying_daily_return_pct',
  'gross_hedged_daily_return_pct', 'net_hedged_daily_return_pct',
  'unhedged_equity', 'gross_hedged_equity', 'net_hedged_equity',
  'hedge_notional', 'delta_hedge_notional', 'required_margin',
  'funding_daily', 'basis_daily', 'collateral_effect_daily',
  'fee_cost', 'slippage_cost', 'funding_effect', 'basis_effect',
  'collateral_effect', 'net_implementation_cost',
  'net_implementation_cost_pct_of_equity'
];

const SUMMARY_COLUMNS = [
  'policyId', 'economicScenarioId', 'validReturnDays',
  'gross_hedged_return_pct', 'net_hedged_return_pct',
  'gross_CAGRpct', 'net_CAGRpct',
  'gross_maxDrawdownPct', 'net_maxDrawdownPct',
  'net_maxUnderwaterDurationDays', 'net_volatilityPct',
  'net_historicalVaRPct', 'net_ewmaMaxPct',
  'total_fees', 'total_slippage', 'total_funding',
  'total_basis_effect', 'total_collateral_effect',
  'net_implementation_cost', 'max_margin_required',
  'average_margin_required', 'collateral_utilization_pct',
  'hedge_turnover', 'hedge_events', 'cost_per_hedge_event',
  'cost_as_pct_of_equity', 'net_drawdown_reduction_pct_points',
  'net_return_sacrificed_pct', 'net_return_effect',
  'net_protection_efficiency'
];

const YEARLY_COLUMNS = [
  'year', 'regime', ...SUMMARY_COLUMNS
];

const COMPARISON_COLUMNS = [
  'seriesId', 'policyId', 'economicScenarioId', 'validReturnDays',
  'totalReturnPct', 'CAGRpct', 'maxDrawdownPct',
  'maxUnderwaterDurationDays', 'volatilityPct',
  'historicalVaRPct', 'ewmaMaxPct'
];

function signalKey(year, date) {
  return `${year}|${date}`;
}

function isoDateFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
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

function hedgeRatioFor(state, policy) {
  if (state === 'stress') return policy.stressHedgePct / 100;
  if (state === 'crisis') return policy.crisisHedgePct / 100;
  return 0;
}

function roundStats(stats) {
  return Object.fromEntries(Object.entries(stats).map(([key, value]) => [
    key,
    typeof value === 'number' ? roundNumber(value) : value
  ]));
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

async function bybitGetFundingPage(endTime) {
  const params = new URLSearchParams({
    category: 'linear',
    symbol: BYBIT_SYMBOL,
    endTime: String(endTime),
    limit: '200'
  });
  const response = await fetch(`${BYBIT_FUNDING_URL}?${params}`);
  if (!response.ok) throw new Error(`Bybit funding API error: ${response.status} ${response.statusText}`);
  const payload = await response.json();
  if (payload.retCode !== 0) throw new Error(`Bybit funding API error: ${payload.retCode} ${payload.retMsg}`);
  return Array.isArray(payload.result && payload.result.list) ? payload.result.list : [];
}

async function fetchHistoricalFunding() {
  const byTimestamp = new Map();
  let endTime = FUNDING_END_MS;
  while (endTime >= FUNDING_START_MS) {
    const page = await bybitGetFundingPage(endTime);
    if (!page.length) break;
    const parsed = page
      .map(row => ({
        symbol: row.symbol,
        fundingRate: optionalNumber(row.fundingRate),
        fundingRateTimestamp: optionalNumber(row.fundingRateTimestamp)
      }))
      .filter(row => row.symbol === BYBIT_SYMBOL && row.fundingRate !== null && row.fundingRateTimestamp !== null)
      .sort((a, b) => b.fundingRateTimestamp - a.fundingRateTimestamp);

    for (const row of parsed) {
      if (row.fundingRateTimestamp >= FUNDING_START_MS && row.fundingRateTimestamp <= FUNDING_END_MS) {
        byTimestamp.set(row.fundingRateTimestamp, row);
      }
    }

    const oldest = parsed.length ? Math.min(...parsed.map(row => row.fundingRateTimestamp)) : null;
    if (oldest === null || oldest <= FUNDING_START_MS) break;
    endTime = oldest - 1;
  }

  return Array.from(byTimestamp.values())
    .sort((a, b) => a.fundingRateTimestamp - b.fundingRateTimestamp)
    .map(row => ({
      date: isoDateFromMs(row.fundingRateTimestamp),
      symbol: row.symbol,
      fundingRateTimestamp: row.fundingRateTimestamp,
      fundingRate: row.fundingRate
    }));
}

function dailyFundingMap(fundingRows) {
  const map = new Map();
  for (const row of fundingRows) {
    map.set(row.date, (map.get(row.date) || 0) + row.fundingRate);
  }
  return map;
}

async function loadFunding() {
  let fundingRows = [];
  let historicalFundingUsed = false;
  let fundingFetchError = null;

  try {
    fundingRows = await fetchHistoricalFunding();
    historicalFundingUsed = fundingRows.length > 0;
  } catch (error) {
    fundingFetchError = error.message;
  }

  const fundingByDate = dailyFundingMap(fundingRows);
  return {
    fundingRows,
    fundingByDate,
    metadata: {
      historicalFundingUsed,
      fundingFetchError,
      fundingSource: historicalFundingUsed ? 'Bybit public /v5/market/funding/history' : 'none',
      fundingSymbol: BYBIT_SYMBOL,
      fundingRows: fundingRows.length,
      fundingDateCount: fundingByDate.size,
      fundingSignConvention: 'For a short perpetual hedge, positive fundingRate is treated as income and negative fundingRate as cost.'
    }
  };
}

function scenarioFundingDaily(row, scenario, fundingByDate) {
  if (scenario.fundingMode === 'historical_or_zero') {
    return fundingByDate.get(row.date) || 0;
  }
  return scenario.fundingProxyDaily;
}

function simulateScenario(baseRows, policy, scenario, fundingByDate) {
  let unhedgedEquity = 1;
  let grossEquity = 1;
  let netEquity = 1;
  let previousHedgeRatio = 0;

  return baseRows.map(row => {
    const ccwPct = optionalNumber(row.ccw_daily_return_pct);
    const underlyingPct = optionalNumber(row.underlying_daily_return_pct);
    if (ccwPct === null || underlyingPct === null) {
      return {
        date: row.date,
        year: row.year,
        regime: row.regime,
        policyId: policy.policyId,
        economicScenarioId: scenario.scenarioId,
        source_alert_state: row.source_alert_state,
        applied_alert_state: null,
        hedge_ratio: null,
        ccw_daily_return_pct: ccwPct,
        underlying_daily_return_pct: underlyingPct,
        gross_hedged_daily_return_pct: null,
        net_hedged_daily_return_pct: null
      };
    }

    const appliedState = delayedState(row.prior_alert_history, 0);
    const hedgeRatio = hedgeRatioFor(appliedState, policy);
    const hedgeNotional = netEquity * hedgeRatio;
    const deltaHedgeNotional = hedgeRatio === previousHedgeRatio
      ? 0
      : netEquity * (hedgeRatio - previousHedgeRatio);
    const requiredMargin = hedgeNotional / scenario.leverage;
    const feeCost = Math.abs(deltaHedgeNotional) * scenario.takerFee;
    const slippageCost = Math.abs(deltaHedgeNotional) * scenario.slippage;
    const fundingDaily = scenarioFundingDaily(row, scenario, fundingByDate);
    const fundingEffect = hedgeNotional * fundingDaily;
    const basisEffect = hedgeNotional * scenario.basisDaily;
    const collateralEffect = requiredMargin * scenario.collateralEffectDaily;
    const grossReturnPct = ccwPct - hedgeRatio * underlyingPct;
    const netImplementationCost = feeCost + slippageCost - fundingEffect - basisEffect - collateralEffect;
    const netReturnPct = grossReturnPct
      - (feeCost / netEquity) * 100
      - (slippageCost / netEquity) * 100
      + (fundingEffect / netEquity) * 100
      + (basisEffect / netEquity) * 100
      + (collateralEffect / netEquity) * 100;

    unhedgedEquity *= 1 + ccwPct / 100;
    grossEquity *= 1 + grossReturnPct / 100;
    netEquity *= 1 + netReturnPct / 100;
    previousHedgeRatio = hedgeRatio;

    return roundStats({
      date: row.date,
      year: row.year,
      regime: row.regime,
      policyId: policy.policyId,
      economicScenarioId: scenario.scenarioId,
      source_alert_state: row.source_alert_state,
      applied_alert_state: appliedState,
      hedge_ratio: hedgeRatio,
      ccw_daily_return_pct: ccwPct,
      underlying_daily_return_pct: underlyingPct,
      gross_hedged_daily_return_pct: grossReturnPct,
      net_hedged_daily_return_pct: netReturnPct,
      unhedged_equity: unhedgedEquity,
      gross_hedged_equity: grossEquity,
      net_hedged_equity: netEquity,
      hedge_notional: hedgeNotional,
      delta_hedge_notional: deltaHedgeNotional,
      required_margin: requiredMargin,
      funding_daily: fundingDaily,
      basis_daily: scenario.basisDaily,
      collateral_effect_daily: scenario.collateralEffectDaily,
      fee_cost: feeCost,
      slippage_cost: slippageCost,
      funding_effect: fundingEffect,
      basis_effect: basisEffect,
      collateral_effect: collateralEffect,
      net_implementation_cost: netImplementationCost,
      net_implementation_cost_pct_of_equity: (netImplementationCost / netEquity) * 100
    });
  });
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (optionalNumber(row[field]) || 0), 0);
}

function summarizeEconomicRows(rows, baseline, policyId, scenarioId) {
  const validRows = rows.filter(row => optionalNumber(row.net_hedged_daily_return_pct) !== null);
  const grossStats = seriesStats(rows, 'gross_hedged_daily_return_pct');
  const netStats = seriesStats(rows, 'net_hedged_daily_return_pct');
  const totalFees = sum(validRows, 'fee_cost');
  const totalSlippage = sum(validRows, 'slippage_cost');
  const totalFunding = sum(validRows, 'funding_effect');
  const totalBasis = sum(validRows, 'basis_effect');
  const totalCollateral = sum(validRows, 'collateral_effect');
  const netImplementationCost = totalFees + totalSlippage - totalFunding - totalBasis - totalCollateral;
  const requiredMargins = validRows.map(row => optionalNumber(row.required_margin)).filter(value => value !== null);
  const utilization = validRows
    .map(row => {
      const margin = optionalNumber(row.required_margin);
      const equity = optionalNumber(row.net_hedged_equity);
      return margin !== null && equity && equity > 0 ? margin / equity : null;
    })
    .filter(value => value !== null);
  const hedgeTurnover = validRows.reduce((total, row) => total + Math.abs(optionalNumber(row.delta_hedge_notional) || 0), 0);
  const hedgeEvents = validRows.filter(row => Math.abs(optionalNumber(row.delta_hedge_notional) || 0) > 1e-12).length;
  const netReturnSacrificed = baseline.totalReturnPct - netStats.totalReturnPct;
  const netDdReduction = Math.abs(baseline.maxDrawdownPct) - Math.abs(netStats.maxDrawdownPct);

  return roundStats({
    policyId,
    economicScenarioId: scenarioId,
    validReturnDays: netStats.validReturnDays,
    gross_hedged_return_pct: grossStats.totalReturnPct,
    net_hedged_return_pct: netStats.totalReturnPct,
    gross_CAGRpct: grossStats.CAGRpct,
    net_CAGRpct: netStats.CAGRpct,
    gross_maxDrawdownPct: grossStats.maxDrawdownPct,
    net_maxDrawdownPct: netStats.maxDrawdownPct,
    net_maxUnderwaterDurationDays: netStats.maxUnderwaterDurationDays,
    net_volatilityPct: netStats.volatilityPct,
    net_historicalVaRPct: netStats.historicalVaRPct,
    net_ewmaMaxPct: netStats.ewmaMaxPct,
    total_fees: totalFees,
    total_slippage: totalSlippage,
    total_funding: totalFunding,
    total_basis_effect: totalBasis,
    total_collateral_effect: totalCollateral,
    net_implementation_cost: netImplementationCost,
    max_margin_required: requiredMargins.length ? Math.max(...requiredMargins) : 0,
    average_margin_required: requiredMargins.length ? mean(requiredMargins) : 0,
    collateral_utilization_pct: utilization.length ? mean(utilization) * 100 : 0,
    hedge_turnover: hedgeTurnover,
    hedge_events: hedgeEvents,
    cost_per_hedge_event: hedgeEvents ? netImplementationCost / hedgeEvents : null,
    cost_as_pct_of_equity: netImplementationCost * 100,
    net_drawdown_reduction_pct_points: netDdReduction,
    net_return_sacrificed_pct: netReturnSacrificed,
    net_return_effect: netReturnSacrificed <= 0 ? 'return improved' : 'return sacrificed',
    net_protection_efficiency: netReturnSacrificed > 0 ? netDdReduction / netReturnSacrificed : null
  });
}

function comparisonRows(baseline, scenarioRows) {
  return [
    {
      seriesId: 'UNHEDGED',
      policyId: null,
      economicScenarioId: null,
      validReturnDays: baseline.validReturnDays,
      totalReturnPct: baseline.totalReturnPct,
      CAGRpct: baseline.CAGRpct,
      maxDrawdownPct: baseline.maxDrawdownPct,
      maxUnderwaterDurationDays: baseline.maxUnderwaterDurationDays,
      volatilityPct: baseline.volatilityPct,
      historicalVaRPct: baseline.historicalVaRPct,
      ewmaMaxPct: baseline.ewmaMaxPct
    },
    ...scenarioRows.map(row => ({
      seriesId: 'NET_HEDGED',
      policyId: row.policyId,
      economicScenarioId: row.economicScenarioId,
      validReturnDays: row.validReturnDays,
      totalReturnPct: row.net_hedged_return_pct,
      CAGRpct: row.net_CAGRpct,
      maxDrawdownPct: row.net_maxDrawdownPct,
      maxUnderwaterDurationDays: row.net_maxUnderwaterDurationDays,
      volatilityPct: row.net_volatilityPct,
      historicalVaRPct: row.net_historicalVaRPct,
      ewmaMaxPct: row.net_ewmaMaxPct
    }))
  ].map(roundStats);
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildFindings(metadata, baseline, scenarioRows, yearlyRows) {
  const grossRiskReducers = scenarioRows.filter(row =>
    Math.abs(row.gross_maxDrawdownPct) < Math.abs(baseline.maxDrawdownPct)
  );
  const netRiskReducers = scenarioRows.filter(row =>
    Math.abs(row.net_maxDrawdownPct) < Math.abs(baseline.maxDrawdownPct)
    && Math.abs(row.net_historicalVaRPct) < Math.abs(baseline.historicalVaRPct)
  );
  const returnImprovers = scenarioRows.filter(row => row.net_return_effect === 'return improved');
  const bestNetReturn = scenarioRows.slice().sort((a, b) => b.net_hedged_return_pct - a.net_hedged_return_pct)[0];
  const bestNetDd = scenarioRows.slice().sort((a, b) => b.net_maxDrawdownPct - a.net_maxDrawdownPct)[0];
  const componentTotals = ['total_fees', 'total_slippage', 'total_funding', 'total_basis_effect', 'total_collateral_effect']
    .map(field => ({ component: field, total: roundNumber(sum(scenarioRows, field)) }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  return [
    '# Realistic Hedge Economics v01',
    '',
    `Generated: ${metadata.generatedAt}`,
    '',
    '## Scope',
    '',
    '- Strategy: BTC Weekly OTM05, 2020-2025.',
    '- Classification: research-grade only.',
    '- No live workflow changes, no Daily MTM changes, no monitoring threshold changes, and no hedge rule changes.',
    '- No order book simulation, liquidation engine, margin calls, or production execution assumptions.',
    '',
    '## Methodology',
    '',
    '```text',
    'gross_hedged_return = ccw_return - hedge_ratio * underlying_return',
    'net_hedged_return = gross_hedged_return - trading_fees - slippage + funding_effect + basis_effect + collateral_effect',
    '```',
    '',
    '- Fees and slippage are always costs and are applied only when the target hedge ratio changes.',
    '- v01 does not assume daily notional rebalancing: equity drift at an unchanged hedge ratio does not create synthetic fee or slippage costs.',
    '- Funding, basis, and collateral effects preserve sign; positive values improve return and negative values reduce return.',
    '- Funding is applied daily on hedge notional. Historical Bybit funding is aggregated by UTC date when available.',
    '- Signal timing follows the v04 research convention: the latest prior valid MTM alert state is applied to the next valid daily return, avoiding same-day lookahead.',
    '',
    '## Funding Data',
    '',
    `- Historical funding used for BASE: ${metadata.funding.historicalFundingUsed ? 'yes' : 'no'}.`,
    `- Funding source: ${metadata.funding.fundingSource}.`,
    `- Funding rows: ${metadata.funding.fundingRows}.`,
    `- Funding date count: ${metadata.funding.fundingDateCount}.`,
    metadata.funding.fundingFetchError ? `- Funding fetch error: ${metadata.funding.fundingFetchError}.` : '- Funding fetch error: none.',
    '',
    '## Unhedged Baseline',
    '',
    markdownTable([baseline], ['validReturnDays', 'totalReturnPct', 'CAGRpct', 'maxDrawdownPct', 'volatilityPct', 'historicalVaRPct', 'ewmaMaxPct']),
    '',
    '## Scenario Summary',
    '',
    markdownTable(scenarioRows, ['policyId', 'economicScenarioId', 'gross_hedged_return_pct', 'net_hedged_return_pct', 'net_CAGRpct', 'net_maxDrawdownPct', 'net_historicalVaRPct', 'total_fees', 'total_slippage', 'total_funding', 'total_basis_effect', 'total_collateral_effect', 'net_implementation_cost', 'net_return_effect']),
    '',
    '## Dominant Components',
    '',
    markdownTable(componentTotals, ['component', 'total']),
    '',
    '## Research Questions',
    '',
    `1. Did the overlay reduce risk gross? ${grossRiskReducers.length === scenarioRows.length ? 'Yes across all scenarios.' : `Partially; ${grossRiskReducers.length} of ${scenarioRows.length} scenarios reduced gross drawdown.`}`,
    `2. Did the overlay still reduce risk net? ${netRiskReducers.length === scenarioRows.length ? 'Yes across all scenarios by drawdown and VaR.' : `Partially; ${netRiskReducers.length} of ${scenarioRows.length} scenarios reduced both net drawdown and VaR.`}`,
    `3. Did net return remain superior to unhedged? ${returnImprovers.length === scenarioRows.length ? 'Yes across all scenarios.' : `Partially; ${returnImprovers.length} of ${scenarioRows.length} scenarios improved aggregate return.`}`,
    `4. Which components dominated? Largest absolute aggregate component: ${componentTotals[0].component} (${componentTotals[0].total}).`,
    `5. Did the result survive BASE, CONSERVATIVE, and STRESS? ${returnImprovers.length === scenarioRows.length && netRiskReducers.length === scenarioRows.length ? 'Yes in this research-grade v01.' : 'Not uniformly; inspect scenario_summary for weak cases.'}`,
    `6. Did stress30_crisis40 remain better than stress25_crisis50? Best net return: ${bestNetReturn.policyId} / ${bestNetReturn.economicScenarioId}; best net drawdown: ${bestNetDd.policyId} / ${bestNetDd.economicScenarioId}.`,
    '7. Assumptions to replace next: funding should move from public daily aggregation/proxies to fully aligned funding intervals; basis should use observed perp/spot or futures basis; slippage should become liquidity/notional-aware; collateral effects should use actual collateral yield or borrowing economics.',
    '',
    '## Yearly Summary',
    '',
    markdownTable(yearlyRows, ['year', 'regime', 'policyId', 'economicScenarioId', 'net_hedged_return_pct', 'net_maxDrawdownPct', 'net_historicalVaRPct', 'net_implementation_cost', 'net_return_effect']),
    '',
    '## Limitations',
    '',
    '- Liquidity is assumed sufficient for current research size.',
    '- Required margin is tracked, but liquidation and margin calls are not modeled.',
    '- Funding is aggregated by UTC date rather than exact intraday hedge holding windows.',
    '- Basis and collateral effects are scenario assumptions, not observed market data.',
    '- Results are not production execution guidance.'
  ].join('\n');
}

function assertNoOverwrite() {
  if (process.argv.includes('--force')) return;
  const outputs = [
    OUTPUT_ASSUMPTIONS_JSON, OUTPUT_DAILY_CSV, OUTPUT_DAILY_JSON,
    OUTPUT_SCENARIO_CSV, OUTPUT_SCENARIO_JSON, OUTPUT_YEARLY_CSV,
    OUTPUT_YEARLY_JSON, OUTPUT_COMPARISON_CSV, OUTPUT_COMPARISON_JSON,
    OUTPUT_FINDINGS_MD, OUTPUT_FUNDING_CSV, OUTPUT_FUNDING_JSON
  ];
  const existing = outputs.filter(file => fs.existsSync(file));
  if (existing.length) {
    throw new Error(`Refusing to overwrite hedge economics v01 outputs: ${existing.map(file => path.relative(REPO_ROOT, file)).join(', ')}`);
  }
}

async function main() {
  assertNoOverwrite();
  const baseRows = buildBaseRows();
  const funding = await loadFunding();
  const baseline = roundStats(seriesStats(baseRows, 'ccw_daily_return_pct'));
  const dailyRows = [];
  const scenarioRows = [];
  const yearlyRows = [];

  for (const policy of POLICIES) {
    for (const scenario of ECONOMIC_SCENARIOS) {
      const rows = simulateScenario(baseRows, policy, scenario, funding.fundingByDate);
      dailyRows.push(...rows);
      scenarioRows.push(summarizeEconomicRows(rows, baseline, policy.policyId, scenario.scenarioId));

      for (const year of YEARS) {
        const yearRows = rows.filter(row => row.year === year.year);
        const yearBase = baseRows.filter(row => row.year === year.year);
        const yearBaseline = seriesStats(yearBase, 'ccw_daily_return_pct');
        yearlyRows.push({
          year: year.year,
          regime: year.regime,
          ...summarizeEconomicRows(yearRows, yearBaseline, policy.policyId, scenario.scenarioId)
        });
      }
    }
  }

  const metadata = {
    generatedAt: new Date().toISOString(),
    classification: 'research-grade only',
    methodology: 'v03/v04 underlying-overlay with v01 realistic hedge economics',
    formula: 'net_hedged_return = ccw_return - hedge_ratio * underlying_return - fees - slippage + funding_effect + basis_effect + collateral_effect',
    signalTiming: 'The applied alert_state is the latest prior valid MTM alert_state, not the same-day signal. This matches v04 timing and avoids lookahead bias.',
    rebalancingConvention: 'Fees and slippage are charged only when hedge_ratio changes. Equity drift while hedge_ratio is unchanged does not create a synthetic daily rebalance cost.',
    policies: POLICIES,
    economicScenarios: ECONOMIC_SCENARIOS,
    funding: funding.metadata,
    baseline
  };
  const comparison = comparisonRows(baseline, scenarioRows);

  fs.mkdirSync(OUTPUT_DIR_V01, { recursive: true });
  fs.writeFileSync(OUTPUT_ASSUMPTIONS_JSON, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_DAILY_CSV, `${objectsToCsv(dailyRows, DAILY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_DAILY_JSON, `${JSON.stringify({ metadata, rows: dailyRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SCENARIO_CSV, `${objectsToCsv(scenarioRows, SUMMARY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_SCENARIO_JSON, `${JSON.stringify({ metadata, rows: scenarioRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_CSV, `${objectsToCsv(yearlyRows, YEARLY_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_YEARLY_JSON, `${JSON.stringify({ metadata, rows: yearlyRows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_CSV, `${objectsToCsv(comparison, COMPARISON_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_COMPARISON_JSON, `${JSON.stringify({ metadata, rows: comparison }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FINDINGS_MD, buildFindings(metadata, baseline, scenarioRows, yearlyRows), 'utf8');
  fs.writeFileSync(OUTPUT_FUNDING_CSV, `${objectsToCsv(funding.fundingRows, ['date', 'symbol', 'fundingRateTimestamp', 'fundingRate'])}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_FUNDING_JSON, `${JSON.stringify({ metadata: funding.metadata, rows: funding.fundingRows }, null, 2)}\n`, 'utf8');

  for (const file of [
    OUTPUT_ASSUMPTIONS_JSON, OUTPUT_DAILY_CSV, OUTPUT_DAILY_JSON,
    OUTPUT_SCENARIO_CSV, OUTPUT_SCENARIO_JSON, OUTPUT_YEARLY_CSV,
    OUTPUT_YEARLY_JSON, OUTPUT_COMPARISON_CSV, OUTPUT_COMPARISON_JSON,
    OUTPUT_FINDINGS_MD, OUTPUT_FUNDING_CSV, OUTPUT_FUNDING_JSON
  ]) {
    console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
  }
  console.log(`Historical funding used for BASE: ${metadata.funding.historicalFundingUsed ? 'yes' : 'no'}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error building realistic hedge economics v01:', error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildBaseRows,
  simulateScenario,
  summarizeEconomicRows,
  fetchHistoricalFunding
};
