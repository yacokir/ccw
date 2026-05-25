const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  OUTPUT_DIR,
  readCsv,
  objectsToCsv,
  optionalNumber,
  roundNumber,
  percentile,
  mean,
  sampleStdDev
} = require('./btc_deep_risk_utils');

const RUN_DIR = path.join(
  REPO_ROOT,
  'runs',
  'btc_2025-01-03_2025-12-31T08-00-00Z_otm10_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
);
const TRADES_CSV = path.join(RUN_DIR, 'trades.csv');
const PREFIX = 'poc_daily_mtm_ccw_2025';
const OUTPUT_CSV = path.join(OUTPUT_DIR, `${PREFIX}.csv`);
const OUTPUT_JSON = path.join(OUTPUT_DIR, `${PREFIX}.json`);
const OUTPUT_MD = path.join(OUTPUT_DIR, `${PREFIX}.md`);

const DERIBIT_API = 'https://www.deribit.com/api/v2';
const SNAPSHOT_TIME_NY = '10:00';
const EWMA_LAMBDA = 0.94;
const HISTORICAL_VAR_WINDOW_DAYS = 30;
const HISTORICAL_VAR_PERCENTILE = 0.05;
const REQUEST_TIMEOUT_MS = Number(process.env.DERIBIT_DAILY_MTM_TIMEOUT_MS || 15000);
const REQUEST_CONCURRENCY = Number(process.env.DERIBIT_DAILY_MTM_CONCURRENCY || 6);
const REQUEST_PAUSE_MS = Number(process.env.DERIBIT_DAILY_MTM_PAUSE_MS || 0);

const OUTPUT_COLUMNS = [
  'date',
  'snapshot_time_ny',
  'snapshot_time_utc',
  'snapshot_timestamp',
  'cycle_id',
  'instrument_name',
  'BTC_price',
  'option_price_proxy',
  'option_price_proxy_btc',
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
  'btc_price_found',
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

function nySnapshotTimestampUtc(dateLabelValue) {
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
  const localBaseUtc = Date.parse(`${dateLabelValue}T${SNAPSHOT_TIME_NY}:00.000Z`);
  return localBaseUtc - offsetMinutes * 60 * 1000;
}

function buildDailyRequests(trades) {
  const requests = [];
  for (const trade of trades) {
    const entryTs = parseTimestamp(trade.entry_date);
    const exitTs = parseTimestamp(trade.exit_date);
    if (entryTs === null || exitTs === null || exitTs <= entryTs) continue;

    const current = new Date(entryTs);
    current.setUTCHours(0, 0, 0, 0);

    while (current.getTime() < exitTs) {
      const day = dateLabel(current.getTime());
      const snapshotTs = nySnapshotTimestampUtc(day);
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

async function evaluateRequest(request, btcCache) {
  const notes = [];
  let btcCandle = null;
  let optionCandle = null;

  const btcKey = String(request.snapshotTimestamp);
  const btcPromise = btcCache.has(btcKey)
    ? Promise.resolve(btcCache.get(btcKey))
    : getTradingviewCandle('BTC-PERPETUAL', request.snapshotTimestamp, 1)
      .then(candle => {
        btcCache.set(btcKey, candle);
        return candle;
      })
      .catch(error => {
        notes.push(`btc_ohlc_error:${error.message}`);
        btcCache.set(btcKey, null);
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

  btcCandle = await btcPromise;
  await optionPromise;

  if (REQUEST_PAUSE_MS > 0) await sleep(REQUEST_PAUSE_MS);

  const btcPrice = btcCandle && Number.isFinite(btcCandle.close) ? btcCandle.close : null;
  const optionPriceBtc = optionCandle && Number.isFinite(optionCandle.close) ? optionCandle.close : null;
  const optionPriceUsd = btcPrice !== null && optionPriceBtc !== null ? optionPriceBtc * btcPrice : null;
  const ccwValue = btcPrice !== null && optionPriceUsd !== null ? btcPrice - optionPriceUsd : null;

  if (btcPrice === null) notes.push('missing_btc_price');
  if (request.instrumentName && optionPriceBtc === null) notes.push('missing_option_1m_candle_close');

  return {
    date: request.date,
    snapshot_time_ny: SNAPSHOT_TIME_NY,
    snapshot_time_utc: request.snapshotTimeUtc,
    snapshot_timestamp: request.snapshotTimestamp,
    cycle_id: request.cycleId,
    instrument_name: request.instrumentName,
    BTC_price: btcPrice,
    option_price_proxy: optionPriceUsd,
    option_price_proxy_btc: optionPriceBtc,
    option_price_proxy_source: optionPriceBtc === null ? null : 'Deribit option 1-minute OHLC close at 10:00 NY snapshot; BTC-denominated close converted to USD with snapshot BTC-PERPETUAL close',
    approximate_CCW_value: ccwValue,
    btc_price_found: btcPrice !== null,
    option_price_found: optionPriceBtc !== null,
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

function summarize(rows, startedAt, inputTradeCount, requestCount) {
  const runtimeMs = Date.now() - startedAt;
  const completeRows = rows.filter(row => row.btc_price_found && row.option_price_found && optionalNumber(row.approximate_CCW_value) !== null);
  const missingRows = rows.length - completeRows.length;
  const returns = rows.map(row => optionalNumber(row.daily_return)).filter(Number.isFinite);
  const absReturns = returns.map(value => Math.abs(value));
  const suspiciousJumpRows = rows.filter(row => {
    const value = optionalNumber(row.daily_return);
    return value !== null && Math.abs(value) >= 0.10;
  });
  const optionObservedRequests = rows.filter(row => row.instrument_name).length;
  const optionFoundRows = rows.filter(row => row.option_price_found).length;
  const values = completeRows.map(row => optionalNumber(row.approximate_CCW_value)).filter(Number.isFinite);
  const drawdowns = rows.map(row => optionalNumber(row.rolling_drawdown)).filter(Number.isFinite);

  return {
    generatedAt: new Date().toISOString(),
    runtimeMs,
    runtimeSeconds: roundNumber(runtimeMs / 1000, 3),
    scope: {
      asset: 'BTC',
      tenor: 'weekly',
      moneyness: 'OTM10',
      year: 2025,
      sourceRun: path.relative(REPO_ROOT, RUN_DIR),
      sourceTradesCsv: path.relative(REPO_ROOT, TRADES_CSV),
      snapshotTimeNy: SNAPSHOT_TIME_NY,
      snapshotTimeUtc: '14:00 UTC during New York daylight saving time and 15:00 UTC during New York standard time',
      notional: 'Per 1 BTC covered-call unit'
    },
    methodology: {
      valuation: 'approximate_CCW_value = BTC_price - option_price_proxy_usd',
      btcProxy: 'Deribit public/get_tradingview_chart_data BTC-PERPETUAL 1-minute candle close at the daily 10:00 NY snapshot.',
      optionProxy: 'Deribit public/get_tradingview_chart_data exact traded option instrument 1-minute candle close at the daily 10:00 NY snapshot.',
      optionCurrency: 'BTC option candle close is treated as BTC-denominated option premium and converted to USD using the snapshot BTC-PERPETUAL close.',
      dailyReturn: 'Computed only from adjacent calendar-day valid approximate_CCW_value observations; missing MTM gaps are not bridged into a single daily return.',
      ewmaVol: `Daily EWMA volatility over approximate CCW returns with lambda = ${EWMA_LAMBDA}.`,
      historicalVaR: `Empirical ${HISTORICAL_VAR_PERCENTILE * 100}th percentile over the previous ${HISTORICAL_VAR_WINDOW_DAYS} valid daily returns. Current-day return is excluded from the VaR window.`
    },
    validation: {
      inputTradeCount,
      totalDailyRows: rows.length,
      totalDailyRequests: requestCount,
      completeMtmRows: completeRows.length,
      missingDataRows: missingRows,
      missingDataPct: roundNumber(missingRows / Math.max(rows.length, 1) * 100),
      btcPriceAvailabilityPct: roundNumber(rows.filter(row => row.btc_price_found).length / Math.max(rows.length, 1) * 100),
      optionObservedRequestCount: optionObservedRequests,
      optionPriceAvailabilityPctOfAllRows: roundNumber(optionFoundRows / Math.max(rows.length, 1) * 100),
      optionPriceAvailabilityPctOfObservedInstrumentRows: roundNumber(optionFoundRows / Math.max(optionObservedRequests, 1) * 100),
      syntheticOrMissingInstrumentRows: rows.filter(row => !row.instrument_name).length,
      validDailyReturnCount: returns.length,
      historicalVaRRows: rows.filter(row => optionalNumber(row.historical_VaR) !== null).length,
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
      maxAbsDailyReturnPct: absReturns.length ? roundNumber(Math.max(...absReturns) * 100) : null
    },
    suspiciousJumpRows: suspiciousJumpRows.map(row => ({
      date: row.date,
      cycle_id: row.cycle_id,
      instrument_name: row.instrument_name,
      daily_return_pct: roundNumber(optionalNumber(row.daily_return) * 100),
      BTC_price: roundNumber(row.BTC_price),
      option_price_proxy: roundNumber(row.option_price_proxy),
      approximate_CCW_value: roundNumber(row.approximate_CCW_value),
      notes: row.notes
    })),
    caveats: [
      'This is approximate MTM, not official portfolio accounting.',
      'Option OHLC/trade-price proxies are imperfect and may be stale, sparse, spread-distorted, or liquidity-distorted.',
      'No Greeks, implied-volatility surface, delta-aware hedge, funding, slippage, margin, liquidation, or execution costs are modeled.',
      'Previously tested public Deribit endpoints did not provide official historical point-in-time option Greeks/marks for this use case.',
      'Synthetic/theoretical cycles without an exact observed option instrument cannot be valued by this exact-option OHLC prototype.'
    ],
    assessment: {
      approximateMtmViable: completeRows.length >= rows.length * 0.65 && suspiciousJumpRows.length <= Math.max(5, rows.length * 0.05),
      optionOhlcAppearsUsable: optionFoundRows >= optionObservedRequests * 0.85,
      dailyReturnDistributionUsableForFutureResearch: returns.length >= 150 && suspiciousJumpRows.length <= Math.max(5, rows.length * 0.05),
      runtimeManageable: runtimeMs < 5 * 60 * 1000
    }
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
    '# Daily Approximate MTM CCW Prototype - BTC Weekly OTM10 2025',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Scope',
    '',
    `- Asset/strategy/year: ${summary.scope.asset} ${summary.scope.tenor} ${summary.scope.moneyness} ${summary.scope.year}.`,
    `- Source run: ${summary.scope.sourceRun}.`,
    `- Snapshot: ${summary.scope.snapshotTimeNy} New York time (${summary.scope.snapshotTimeUtc}).`,
    '- Purpose: one-year prototype only; no hedge framework, delta-aware hedge, greeks engine, execution-engine change, or unrelated research rerun.',
    '',
    '## Methodology',
    '',
    `- Valuation: ${summary.methodology.valuation}.`,
    `- BTC proxy: ${summary.methodology.btcProxy}`,
    `- Option proxy: ${summary.methodology.optionProxy}`,
    `- Option currency handling: ${summary.methodology.optionCurrency}`,
    `- EWMA volatility: ${summary.methodology.ewmaVol}`,
    `- Historical VaR: ${summary.methodology.historicalVaR}`,
    '',
    '## Validation',
    '',
    `- Runtime: ${summary.runtimeSeconds}s.`,
    `- Total daily rows: ${summary.validation.totalDailyRows}.`,
    `- Complete MTM rows: ${summary.validation.completeMtmRows}.`,
    `- Missing-data rows: ${summary.validation.missingDataRows} (${summary.validation.missingDataPct}%).`,
    `- BTC price availability: ${summary.validation.btcPriceAvailabilityPct}%.`,
    `- Option OHLC availability among exact observed-instrument rows: ${summary.validation.optionPriceAvailabilityPctOfObservedInstrumentRows}%.`,
    `- Synthetic/missing-instrument rows: ${summary.validation.syntheticOrMissingInstrumentRows}.`,
    `- Valid daily returns: ${summary.validation.validDailyReturnCount}.`,
    `- Historical VaR rows: ${summary.validation.historicalVaRRows}.`,
    `- Suspicious jumps with absolute daily return >= 10%: ${summary.validation.suspiciousJumpCountAbsReturnGte10Pct}.`,
    '',
    '## Daily Return And Drawdown Metrics',
    '',
    `- First/last valid date: ${summary.metrics.firstValidDate} / ${summary.metrics.lastValidDate}.`,
    `- Mean daily return: ${summary.metrics.meanDailyReturnPct}%.`,
    `- Daily volatility: ${summary.metrics.dailyVolPct}%.`,
    `- Worst/best daily return: ${summary.metrics.worstDailyReturnPct}% / ${summary.metrics.bestDailyReturnPct}%.`,
    `- 5th/95th percentile daily return: ${summary.metrics.p05DailyReturnPct}% / ${summary.metrics.p95DailyReturnPct}%.`,
    `- Max daily drawdown: ${summary.metrics.maxDrawdownPct}%.`,
    `- Max absolute daily return: ${summary.metrics.maxAbsDailyReturnPct}%.`,
    '',
    '## Assessment',
    '',
    `- Approximate MTM viable in this prototype: ${summary.assessment.approximateMtmViable ? 'yes' : 'not fully proven'}.`,
    `- Option OHLC appears usable: ${summary.assessment.optionOhlcAppearsUsable ? 'yes' : 'not fully proven'}.`,
    `- Daily return distribution usable for future research: ${summary.assessment.dailyReturnDistributionUsableForFutureResearch ? 'yes' : 'not fully proven'}.`,
    `- Runtime manageable: ${summary.assessment.runtimeManageable ? 'yes' : 'no'}.`,
    '',
    '## Suspicious Jumps',
    '',
    summary.suspiciousJumpRows.length
      ? markdownTable(summary.suspiciousJumpRows.slice(0, 20), [
        'date',
        'cycle_id',
        'instrument_name',
        'daily_return_pct',
        'BTC_price',
        'option_price_proxy',
        'approximate_CCW_value'
      ])
      : '- No absolute daily returns >= 10% were observed.',
    '',
    '## Caveats',
    '',
    ...summary.caveats.map(item => `- ${item}`),
    ''
  ].join('\n');
}

async function main() {
  const startedAt = Date.now();
  const trades = readCsv(TRADES_CSV);
  const requests = buildDailyRequests(trades);
  const btcCache = new Map();
  const rawRows = [];

  console.log(`Loaded ${trades.length} trade rows from ${path.relative(REPO_ROOT, TRADES_CSV)}`);
  console.log(`Built ${requests.length} daily 10:00 NY snapshot requests.`);
  console.log(`Using request concurrency: ${REQUEST_CONCURRENCY}; timeout: ${REQUEST_TIMEOUT_MS}ms`);

  let nextIndex = 0;
  let completed = 0;
  async function worker() {
    while (nextIndex < requests.length) {
      const index = nextIndex;
      nextIndex += 1;
      const request = requests[index];
      rawRows[index] = await evaluateRequest(request, btcCache);
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
  const summary = summarize(rows, startedAt, trades.length, requests.length);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_CSV, `${objectsToCsv(rows, OUTPUT_COLUMNS)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify({ ...summary, rows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(summary), 'utf8');

  console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
  console.log(`Runtime seconds: ${summary.runtimeSeconds}`);
  console.log(`Total daily rows: ${summary.validation.totalDailyRows}`);
  console.log(`Missing-data pct: ${summary.validation.missingDataPct}`);
  console.log(`Suspicious jumps >= 10% abs return: ${summary.validation.suspiciousJumpCountAbsReturnGte10Pct}`);
  console.log(`Approximate MTM viable: ${summary.assessment.approximateMtmViable}`);
  console.log(`Option OHLC appears usable: ${summary.assessment.optionOhlcAppearsUsable}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running daily approximate MTM CCW prototype:', error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildDailyRequests,
  addDailyMetrics,
  summarize,
  nySnapshotTimestampUtc
};
