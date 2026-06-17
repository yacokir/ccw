const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  readCsv,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  percentile,
  mean,
  sampleStdDev
} = require('./btc_deep_risk_utils');

const DERIBIT_API = 'https://www.deribit.com/api/v2';
const EWMA_LAMBDA = 0.94;
const HISTORICAL_VAR_WINDOW_DAYS = 30;
const HISTORICAL_VAR_PERCENTILE = 0.05;
const REQUEST_TIMEOUT_MS = Number(process.env.DERIBIT_DAILY_MTM_TIMEOUT_MS || 15000);
const REQUEST_CONCURRENCY = Number(process.env.DERIBIT_DAILY_MTM_CONCURRENCY || 6);
const REQUEST_PAUSE_MS = Number(process.env.DERIBIT_DAILY_MTM_PAUSE_MS || 0);

const CONFIGS = {
  btcWeeklyOtm05_2020: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2020,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2020-01-03_2020-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2020'),
    prefix: 'btc_weekly_otm05_2020_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  btcWeeklyOtm05_2021: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2021,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2021-01-01_2021-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2021'),
    prefix: 'btc_weekly_otm05_2021_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  btcWeeklyOtm05_2022: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2022,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2022-01-07_2022-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2022'),
    prefix: 'btc_weekly_otm05_2022_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  btcWeeklyOtm05_2023: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2023,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2023-01-06_2023-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2023'),
    prefix: 'btc_weekly_otm05_2023_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  btcWeeklyOtm05_2024: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2024,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2024-01-05_2024-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_otm05_multiyear', 'years', 'btc_weekly_otm05_2024'),
    prefix: 'btc_weekly_otm05_2024_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  btcWeeklyOtm05_2025: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2025,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2025-01-03_2025-12-31T08-00-00Z_otm05_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_weekly_otm05_2025'),
    prefix: 'btc_weekly_otm05_2025_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  btcWeeklyOtm10_2025: {
    asset: 'BTC',
    tenor: 'weekly',
    moneyness: 'OTM10',
    year: 2025,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'btc_2025-01-03_2025-12-31T08-00-00Z_otm10_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
    ),
    underlyingInstrument: 'BTC-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'btc_weekly_otm10_2025'),
    prefix: 'btc_weekly_otm10_2025_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  ethWeeklyOtm05_2025: {
    asset: 'ETH',
    tenor: 'weekly',
    moneyness: 'OTM05',
    year: 2025,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'eth_2025-01-03_2025-12-31T08-00-00Z_x05_step50_longbtc_dyn_entry08h00_delay60m_deribitethusddeliveryprice_001'
    ),
    underlyingInstrument: 'ETH-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'eth_weekly_otm05_2025'),
    prefix: 'eth_weekly_otm05_2025_daily_mtm',
    snapshotTimeNy: '10:00'
  },
  ethWeeklyOtm03_2025: {
    asset: 'ETH',
    tenor: 'weekly',
    moneyness: 'OTM03',
    year: 2025,
    runDir: path.join(
      REPO_ROOT,
      'runs',
      'eth_2025-01-03_2025-12-31T08-00-00Z_x03_step50_longbtc_dyn_entry08h00_delay60m_deribitethusddeliveryprice_001'
    ),
    underlyingInstrument: 'ETH-PERPETUAL',
    outputDir: path.join(REPO_ROOT, 'analysis', 'generated', 'daily_mtm', 'eth_weekly_otm03_2025'),
    prefix: 'eth_weekly_otm03_2025_daily_mtm',
    snapshotTimeNy: '10:00'
  }
};

const OUTPUT_COLUMNS = [
  'date',
  'snapshot_time_ny',
  'snapshot_time_utc',
  'snapshot_timestamp',
  'cycle_id',
  'instrument_name',
  'underlying_price',
  'option_price_proxy',
  'option_price_proxy_underlying',
  'option_price_proxy_source',
  'approximate_CCW_value',
  'daily_return',
  'daily_return_pct',
  'rolling_peak',
  'rolling_drawdown',
  'rolling_drawdown_pct',
  'EWMA_vol',
  'EWMA_vol_pct',
  'historical_VaR',
  'historical_VaR_pct',
  'underlying_price_found',
  'option_price_found',
  'notes'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dateLabel(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseTimestamp(value) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function nySnapshotTimestampUtc(dateLabelValue, snapshotTimeNy) {
  const noonUtc = Date.parse(`${dateLabelValue}T12:00:00.000Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(noonUtc));
  const offsetPart = parts.find(part => part.type === 'timeZoneName');
  const match = offsetPart && offsetPart.value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Could not determine New York UTC offset for ${dateLabelValue}`);
  const sign = match[1] === '-' ? -1 : 1;
  const offsetMinutes = sign * (Number(match[2]) * 60 + Number(match[3] || 0));
  const localBaseUtc = Date.parse(`${dateLabelValue}T${snapshotTimeNy}:00.000Z`);
  return localBaseUtc - offsetMinutes * 60 * 1000;
}

function buildDailyRequests(trades, config) {
  const requests = [];
  for (const trade of trades) {
    const entryTs = parseTimestamp(trade.entry_date);
    const exitTs = parseTimestamp(trade.exit_date);
    if (entryTs === null || exitTs === null || exitTs <= entryTs) continue;

    const current = new Date(entryTs);
    current.setUTCHours(0, 0, 0, 0);

    while (current.getTime() < exitTs) {
      const day = dateLabel(current.getTime());
      const snapshotTs = nySnapshotTimestampUtc(day, config.snapshotTimeNy);
      if (snapshotTs >= entryTs && snapshotTs < exitTs) {
        requests.push({
          date: day,
          snapshotTimestamp: snapshotTs,
          snapshotTimeUtc: new Date(snapshotTs).toISOString().slice(11, 16),
          cycleId: Number(trade.cycle),
          instrumentName: trade.option_instrument || null,
          entryDate: trade.entry_date,
          exitDate: trade.exit_date,
          optionEntryIsSynthetic: String(trade.option_entry_is_synthetic).toLowerCase() === 'true'
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }
  return requests.sort((a, b) => a.snapshotTimestamp - b.snapshotTimestamp || a.cycleId - b.cycleId);
}

async function deribitGet(method, params) {
  const query = new URLSearchParams(params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${DERIBIT_API}/${method}?${query}`, { signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`${method} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = payload && payload.error ? payload.error.message : text.slice(0, 200);
    throw new Error(`${method} HTTP ${response.status} ${response.statusText} ${message}`);
  }
  if (payload && payload.error) throw new Error(`${method} ${payload.error.message || JSON.stringify(payload.error)}`);
  return payload.result;
}

async function deribitGetWithRetry(method, params, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await deribitGet(method, params);
    } catch (error) {
      lastError = error;
      const retryable = /HTTP 429|timed out|fetch failed|network/i.test(error.message || '');
      if (!retryable || attempt === retries) break;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

async function getTradingviewCandle(instrumentName, timestamp, resolution = 1) {
  const result = await deribitGetWithRetry('public/get_tradingview_chart_data', {
    instrument_name: instrumentName,
    start_timestamp: String(timestamp),
    end_timestamp: String(timestamp + 60 * 1000),
    resolution: String(resolution)
  });

  if (!result || result.status !== 'ok' || !Array.isArray(result.ticks) || result.ticks.length === 0) {
    return null;
  }

  const index = result.ticks.findIndex(tick => Number(tick) >= timestamp);
  const i = index === -1 ? 0 : index;
  const close = Number(result.close[i]);
  if (!Number.isFinite(close)) return null;
  return {
    timestamp: Number(result.ticks[i]),
    open: Number(result.open[i]),
    high: Number(result.high[i]),
    low: Number(result.low[i]),
    close,
    volume: Number(result.volume[i])
  };
}

async function evaluateRequest(request, config, underlyingCache) {
  const notes = [];
  let underlyingCandle = null;
  let optionCandle = null;

  const underlyingKey = String(request.snapshotTimestamp);
  const underlyingPromise = underlyingCache.has(underlyingKey)
    ? Promise.resolve(underlyingCache.get(underlyingKey))
    : getTradingviewCandle(config.underlyingInstrument, request.snapshotTimestamp, 1)
      .then(candle => {
        underlyingCache.set(underlyingKey, candle);
        return candle;
      })
      .catch(error => {
        notes.push(`underlying_ohlc_error:${error.message}`);
        underlyingCache.set(underlyingKey, null);
        return null;
      });

  const optionPromise = request.instrumentName
    ? getTradingviewCandle(request.instrumentName, request.snapshotTimestamp, 1)
      .then(candle => {
        optionCandle = candle;
      })
      .catch(error => {
        notes.push(`option_ohlc_error:${error.message}`);
      })
    : Promise.resolve().then(() => {
      notes.push('missing_observed_option_instrument; synthetic/theoretical cycle excluded from option valuation');
    });

  underlyingCandle = await underlyingPromise;
  await optionPromise;

  if (REQUEST_PAUSE_MS > 0) await sleep(REQUEST_PAUSE_MS);

  const underlyingPrice = underlyingCandle && Number.isFinite(underlyingCandle.close) ? underlyingCandle.close : null;
  const optionPriceUnderlying = optionCandle && Number.isFinite(optionCandle.close) ? optionCandle.close : null;
  const optionPriceUsd = underlyingPrice !== null && optionPriceUnderlying !== null
    ? optionPriceUnderlying * underlyingPrice
    : null;
  const ccwValue = underlyingPrice !== null && optionPriceUsd !== null ? underlyingPrice - optionPriceUsd : null;

  if (underlyingPrice === null) notes.push('missing_underlying_price');
  if (request.instrumentName && optionPriceUnderlying === null) notes.push('missing_option_1m_candle_close');

  return {
    date: request.date,
    snapshot_time_ny: config.snapshotTimeNy,
    snapshot_time_utc: request.snapshotTimeUtc,
    snapshot_timestamp: request.snapshotTimestamp,
    cycle_id: request.cycleId,
    instrument_name: request.instrumentName,
    underlying_price: underlyingPrice,
    option_price_proxy: optionPriceUsd,
    option_price_proxy_underlying: optionPriceUnderlying,
    option_price_proxy_source: optionPriceUnderlying === null ? null : `Deribit option 1-minute OHLC close at ${config.snapshotTimeNy} NY snapshot; option-denominated close converted to USD with snapshot ${config.underlyingInstrument} close`,
    approximate_CCW_value: ccwValue,
    underlying_price_found: underlyingPrice !== null,
    option_price_found: optionPriceUnderlying !== null,
    notes
  };
}

function addDailyMetrics(rows) {
  let previousValue = null;
  let previousValueTimestamp = null;
  let rollingPeak = null;
  let ewmaVariance = null;
  const observedReturns = [];

  return rows.map(row => {
    const value = optionalNumber(row.approximate_CCW_value);
    const timestamp = optionalNumber(row.snapshot_timestamp);
    let dailyReturn = null;
    const isAdjacentDailyObservation = (
      value !== null
      && previousValue !== null
      && previousValue > 0
      && timestamp !== null
      && previousValueTimestamp !== null
      && timestamp - previousValueTimestamp <= 36 * 60 * 60 * 1000
    );

    if (isAdjacentDailyObservation) {
      dailyReturn = value / previousValue - 1;
      observedReturns.push(dailyReturn);
    } else if (value !== null && previousValue !== null && timestamp !== null && previousValueTimestamp !== null) {
      row.notes.push('daily_return_not_computed_across_missing_mtm_gap');
    }

    if (dailyReturn !== null) {
      ewmaVariance = ewmaVariance === null
        ? dailyReturn ** 2
        : EWMA_LAMBDA * ewmaVariance + (1 - EWMA_LAMBDA) * dailyReturn ** 2;
    }

    if (value !== null) {
      rollingPeak = rollingPeak === null ? value : Math.max(rollingPeak, value);
      previousValue = value;
      previousValueTimestamp = timestamp;
    }

    const trailingReturns = observedReturns.slice(0, -1).slice(-HISTORICAL_VAR_WINDOW_DAYS);
    const historicalVar = trailingReturns.length >= HISTORICAL_VAR_WINDOW_DAYS
      ? percentile(trailingReturns, HISTORICAL_VAR_PERCENTILE)
      : null;
    const drawdown = value !== null && rollingPeak ? value / rollingPeak - 1 : null;

    return {
      ...row,
      daily_return: dailyReturn,
      daily_return_pct: dailyReturn === null ? null : dailyReturn * 100,
      rolling_peak: rollingPeak,
      rolling_drawdown: drawdown,
      rolling_drawdown_pct: drawdown === null ? null : drawdown * 100,
      EWMA_vol: ewmaVariance === null ? null : Math.sqrt(ewmaVariance),
      EWMA_vol_pct: ewmaVariance === null ? null : Math.sqrt(ewmaVariance) * 100,
      historical_VaR: historicalVar,
      historical_VaR_pct: historicalVar === null ? null : historicalVar * 100
    };
  });
}

function roundRow(row) {
  const rounded = { ...row };
  for (const key of Object.keys(rounded)) {
    if (typeof rounded[key] === 'number') rounded[key] = roundNumber(rounded[key]);
  }
  rounded.notes = Array.isArray(rounded.notes) ? rounded.notes.join('; ') : rounded.notes;
  return rounded;
}

function summarize(rows, config, startedAt, inputTradeCount, requestCount) {
  const runtimeMs = Date.now() - startedAt;
  const completeRows = rows.filter(row => row.underlying_price_found && row.option_price_found && optionalNumber(row.approximate_CCW_value) !== null);
  const returns = rows.map(row => optionalNumber(row.daily_return)).filter(Number.isFinite);
  const absReturns = returns.map(value => Math.abs(value));
  const optionObservedRequests = rows.filter(row => row.instrument_name).length;
  const optionFoundRows = rows.filter(row => row.option_price_found).length;
  const values = completeRows.map(row => optionalNumber(row.approximate_CCW_value)).filter(Number.isFinite);
  const drawdowns = rows.map(row => optionalNumber(row.rolling_drawdown)).filter(Number.isFinite);
  const ewmaVols = rows.map(row => optionalNumber(row.EWMA_vol)).filter(Number.isFinite);
  const vars = rows.map(row => optionalNumber(row.historical_VaR)).filter(Number.isFinite);
  const suspiciousJumpRows = rows.filter(row => {
    const value = optionalNumber(row.daily_return);
    return value !== null && Math.abs(value) >= 0.10;
  });

  return {
    generatedAt: new Date().toISOString(),
    runtimeMs,
    runtimeSeconds: roundNumber(runtimeMs / 1000, 3),
    scope: {
      asset: config.asset,
      tenor: config.tenor,
      moneyness: config.moneyness,
      year: config.year,
      sourceRun: path.relative(REPO_ROOT, config.runDir),
      sourceTradesCsv: path.relative(REPO_ROOT, path.join(config.runDir, 'trades.csv')),
      underlyingInstrument: config.underlyingInstrument,
      snapshotTimeNy: config.snapshotTimeNy,
      notional: `Per 1 ${config.asset} covered-call unit`,
      methodology: 'approximate research MTM'
    },
    methodology: {
      valuation: 'approximate_CCW_value = underlying_price - option_price_proxy_usd',
      underlyingProxy: `Deribit public/get_tradingview_chart_data ${config.underlyingInstrument} 1-minute candle close at the daily ${config.snapshotTimeNy} NY snapshot.`,
      optionProxy: `Deribit public/get_tradingview_chart_data exact traded option instrument 1-minute candle close at the daily ${config.snapshotTimeNy} NY snapshot.`,
      optionCurrency: `Option candle close is treated as ${config.asset}-denominated option premium and converted to USD using the snapshot ${config.underlyingInstrument} close.`,
      dailyReturn: 'Computed only from adjacent calendar-day valid approximate_CCW_value observations; missing MTM gaps are not bridged into a single daily return.',
      ewmaVol: `Daily EWMA volatility over approximate CCW returns with lambda = ${EWMA_LAMBDA}.`,
      historicalVaR: `Empirical ${HISTORICAL_VAR_PERCENTILE * 100}th percentile over the previous ${HISTORICAL_VAR_WINDOW_DAYS} valid daily returns. Current-day return is excluded from the VaR window.`
    },
    validation: {
      inputTradeCount,
      totalDailyRows: rows.length,
      totalDailyRequests: requestCount,
      completeMtmRows: completeRows.length,
      missingDataRows: rows.length - completeRows.length,
      missingDataPct: roundNumber((rows.length - completeRows.length) / Math.max(rows.length, 1) * 100),
      underlyingPriceAvailabilityPct: roundNumber(rows.filter(row => row.underlying_price_found).length / Math.max(rows.length, 1) * 100),
      optionObservedRequestCount: optionObservedRequests,
      optionPriceAvailabilityPctOfAllRows: roundNumber(optionFoundRows / Math.max(rows.length, 1) * 100),
      optionPriceAvailabilityPctOfObservedInstrumentRows: roundNumber(optionFoundRows / Math.max(optionObservedRequests, 1) * 100),
      syntheticOrMissingInstrumentRows: rows.filter(row => !row.instrument_name).length,
      validDailyReturnCount: returns.length,
      historicalVaRRows: vars.length,
      ewmaVolRows: ewmaVols.length,
      suspiciousJumpCountAbsReturnGte10Pct: suspiciousJumpRows.length
    },
    metrics: {
      firstValidDate: completeRows[0] ? completeRows[0].date : null,
      lastValidDate: completeRows.length ? completeRows[completeRows.length - 1].date : null,
      minApproximateCcwValue: values.length ? roundNumber(Math.min(...values)) : null,
      maxApproximateCcwValue: values.length ? roundNumber(Math.max(...values)) : null,
      finalApproximateCcwValue: values.length ? roundNumber(values[values.length - 1]) : null,
      meanDailyReturnPct: returns.length ? roundNumber(mean(returns) * 100) : null,
      dailyVolPct: returns.length > 1 ? roundNumber(sampleStdDev(returns) * 100) : null,
      worstDailyReturnPct: returns.length ? roundNumber(Math.min(...returns) * 100) : null,
      bestDailyReturnPct: returns.length ? roundNumber(Math.max(...returns) * 100) : null,
      p05DailyReturnPct: returns.length ? roundNumber(percentile(returns, 0.05) * 100) : null,
      p95DailyReturnPct: returns.length ? roundNumber(percentile(returns, 0.95) * 100) : null,
      maxDrawdownPct: drawdowns.length ? roundNumber(Math.min(...drawdowns) * 100) : null,
      maxAbsDailyReturnPct: absReturns.length ? roundNumber(Math.max(...absReturns) * 100) : null,
      latestEwmaVolPct: ewmaVols.length ? roundNumber(ewmaVols[ewmaVols.length - 1] * 100) : null,
      maxEwmaVolPct: ewmaVols.length ? roundNumber(Math.max(...ewmaVols) * 100) : null,
      latestHistoricalVaRPct: vars.length ? roundNumber(vars[vars.length - 1] * 100) : null,
      worstHistoricalVaRPct: vars.length ? roundNumber(Math.min(...vars) * 100) : null
    },
    gaps: {
      syntheticOrMissingInstrumentRows: rows.filter(row => !row.instrument_name).length,
      missingOptionPriceRows: rows.filter(row => row.instrument_name && !row.option_price_found).length,
      missingUnderlyingPriceRows: rows.filter(row => !row.underlying_price_found).length,
      dailyReturnGapRows: rows.filter(row => String(row.notes || '').includes('daily_return_not_computed_across_missing_mtm_gap')).map(row => ({
        date: row.date,
        cycle_id: row.cycle_id,
        instrument_name: row.instrument_name,
        notes: row.notes
      })).slice(0, 20)
    },
    suspiciousJumpRows: suspiciousJumpRows.map(row => ({
      date: row.date,
      cycle_id: row.cycle_id,
      instrument_name: row.instrument_name,
      daily_return_pct: roundNumber(optionalNumber(row.daily_return) * 100),
      underlying_price: roundNumber(row.underlying_price),
      option_price_proxy: roundNumber(row.option_price_proxy),
      approximate_CCW_value: roundNumber(row.approximate_CCW_value),
      notes: row.notes
    })),
    caveats: [
      'This is approximate research MTM, not official portfolio accounting.',
      'Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.',
      'No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.',
      'Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC runner.'
    ]
  };
}

function markdownTable(rows, columns) {
  if (!rows.length) return '';
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => row[column] ?? '').join(' | ')} |`)
  ].join('\n');
}

function buildMarkdown(summary) {
  return [
    `# Daily Approximate MTM - ${summary.scope.asset} ${summary.scope.tenor} ${summary.scope.moneyness} ${summary.scope.year}`,
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Scope',
    '',
    `- Asset/strategy/year: ${summary.scope.asset} ${summary.scope.tenor} ${summary.scope.moneyness} ${summary.scope.year}.`,
    `- Methodology label: ${summary.scope.methodology}.`,
    `- Source run: ${summary.scope.sourceRun}.`,
    `- Underlying proxy: ${summary.scope.underlyingInstrument}.`,
    `- Snapshot: ${summary.scope.snapshotTimeNy} New York time.`,
    '',
    '## Methodology',
    '',
    `- Valuation: ${summary.methodology.valuation}.`,
    `- Underlying proxy: ${summary.methodology.underlyingProxy}`,
    `- Option proxy: ${summary.methodology.optionProxy}`,
    `- Option currency handling: ${summary.methodology.optionCurrency}`,
    `- Daily returns: ${summary.methodology.dailyReturn}`,
    `- EWMA volatility: ${summary.methodology.ewmaVol}`,
    `- Historical VaR: ${summary.methodology.historicalVaR}`,
    '',
    '## Validation',
    '',
    `- Runtime: ${summary.runtimeSeconds}s.`,
    `- Total daily rows: ${summary.validation.totalDailyRows}.`,
    `- Complete MTM rows: ${summary.validation.completeMtmRows}.`,
    `- Missing-data rows: ${summary.validation.missingDataRows} (${summary.validation.missingDataPct}%).`,
    `- Underlying price availability: ${summary.validation.underlyingPriceAvailabilityPct}%.`,
    `- Option OHLC availability among exact observed-instrument rows: ${summary.validation.optionPriceAvailabilityPctOfObservedInstrumentRows}%.`,
    `- Synthetic/missing-instrument rows: ${summary.validation.syntheticOrMissingInstrumentRows}.`,
    `- Valid daily returns: ${summary.validation.validDailyReturnCount}.`,
    `- Historical VaR rows: ${summary.validation.historicalVaRRows}.`,
    `- EWMA volatility rows: ${summary.validation.ewmaVolRows}.`,
    '',
    '## Daily Risk Metrics',
    '',
    `- First/last valid date: ${summary.metrics.firstValidDate} / ${summary.metrics.lastValidDate}.`,
    `- Mean daily return: ${summary.metrics.meanDailyReturnPct}%.`,
    `- Daily volatility: ${summary.metrics.dailyVolPct}%.`,
    `- Worst/best daily return: ${summary.metrics.worstDailyReturnPct}% / ${summary.metrics.bestDailyReturnPct}%.`,
    `- 5th/95th percentile daily return: ${summary.metrics.p05DailyReturnPct}% / ${summary.metrics.p95DailyReturnPct}%.`,
    `- Max daily drawdown: ${summary.metrics.maxDrawdownPct}%.`,
    `- Latest/max EWMA volatility: ${summary.metrics.latestEwmaVolPct}% / ${summary.metrics.maxEwmaVolPct}%.`,
    `- Latest/worst historical VaR: ${summary.metrics.latestHistoricalVaRPct}% / ${summary.metrics.worstHistoricalVaRPct}%.`,
    '',
    '## Gaps',
    '',
    `- Synthetic/missing instrument rows: ${summary.gaps.syntheticOrMissingInstrumentRows}.`,
    `- Missing option price rows with observed instrument: ${summary.gaps.missingOptionPriceRows}.`,
    `- Missing underlying price rows: ${summary.gaps.missingUnderlyingPriceRows}.`,
    summary.gaps.dailyReturnGapRows.length
      ? markdownTable(summary.gaps.dailyReturnGapRows, ['date', 'cycle_id', 'instrument_name', 'notes'])
      : '- No daily-return gap rows beyond missing MTM observations were recorded.',
    '',
    '## Caveats',
    '',
    ...summary.caveats.map(item => `- ${item}`),
    ''
  ].join('\n');
}

function assertNoOverwrite(config) {
  const outputs = ['csv', 'json', 'md'].map(ext => path.join(config.outputDir, `${config.prefix}.${ext}`));
  const existing = outputs.filter(filePath => fs.existsSync(filePath));
  if (existing.length) {
    throw new Error(`Refusing to overwrite existing Daily MTM outputs: ${existing.map(filePath => path.relative(REPO_ROOT, filePath)).join(', ')}`);
  }
}

async function runDailyMtm(config) {
  const startedAt = Date.now();
  const tradesCsv = path.join(config.runDir, 'trades.csv');
  if (!fs.existsSync(tradesCsv)) throw new Error(`Missing trades.csv: ${tradesCsv}`);
  assertNoOverwrite(config);

  const trades = readCsv(tradesCsv);
  const requests = buildDailyRequests(trades, config);
  const underlyingCache = new Map();
  const rawRows = [];

  console.log(`Loaded ${trades.length} trade rows from ${path.relative(REPO_ROOT, tradesCsv)}`);
  console.log(`Built ${requests.length} daily ${config.snapshotTimeNy} NY snapshot requests.`);
  console.log(`Using request concurrency: ${REQUEST_CONCURRENCY}; timeout: ${REQUEST_TIMEOUT_MS}ms`);

  let nextIndex = 0;
  let completed = 0;
  async function worker() {
    while (nextIndex < requests.length) {
      const index = nextIndex;
      nextIndex += 1;
      const request = requests[index];
      rawRows[index] = await evaluateRequest(request, config, underlyingCache);
      completed += 1;
      if (completed === 1 || completed % 25 === 0 || completed === requests.length) {
        console.log(`Completed ${completed}/${requests.length}; latest ${request.date} cycle ${request.cycleId}`);
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.max(1, Math.min(REQUEST_CONCURRENCY, requests.length)) },
    () => worker()
  ));

  const rows = addDailyMetrics(rawRows).map(roundRow);
  const summary = summarize(rows, config, startedAt, trades.length, requests.length);
  fs.mkdirSync(config.outputDir, { recursive: true });

  const outputCsv = path.join(config.outputDir, `${config.prefix}.csv`);
  const outputJson = path.join(config.outputDir, `${config.prefix}.json`);
  const outputMd = path.join(config.outputDir, `${config.prefix}.md`);

  fs.writeFileSync(outputCsv, `${objectsToCsv(rows, OUTPUT_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(outputJson, `${JSON.stringify({ ...summary, rows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outputMd, buildMarkdown(summary), 'utf8');

  console.log(`\nWrote ${path.relative(REPO_ROOT, outputCsv)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, outputJson)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, outputMd)}`);
  console.log(`Runtime seconds: ${summary.runtimeSeconds}`);
  console.log(`Total daily rows: ${summary.validation.totalDailyRows}`);
  console.log(`Underlying availability pct: ${summary.validation.underlyingPriceAvailabilityPct}`);
  console.log(`Option availability pct observed instruments: ${summary.validation.optionPriceAvailabilityPctOfObservedInstrumentRows}`);
  console.log(`Valid daily returns: ${summary.validation.validDailyReturnCount}`);
  console.log(`Max drawdown pct: ${summary.metrics.maxDrawdownPct}`);
  return summary;
}

async function main() {
  const configName = process.argv[2] || 'btcWeeklyOtm05_2025';
  const config = CONFIGS[configName];
  if (!config) {
    throw new Error(`Unknown config "${configName}". Available configs: ${Object.keys(CONFIGS).join(', ')}`);
  }
  await runDailyMtm(config);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running Daily MTM:', error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIGS,
  buildDailyRequests,
  addDailyMetrics,
  summarize,
  nySnapshotTimestampUtc,
  runDailyMtm
};
