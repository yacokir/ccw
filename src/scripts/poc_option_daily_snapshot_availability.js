const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUN_DIR = path.join(
  REPO_ROOT,
  'runs',
  'btc_2025-01-03_2025-12-31T08-00-00Z_otm10_step1000_longbtc_dyn_entry08h00_delay60m_deribitbtcusddeliveryprice_001'
);
const TRADES_CSV = path.join(RUN_DIR, 'trades.csv');
const OUTPUT_DIR = path.join(REPO_ROOT, 'analysis', 'generated');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'poc_option_daily_snapshot_availability.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'poc_option_daily_snapshot_availability.json');
const OUTPUT_MD = path.join(OUTPUT_DIR, 'poc_option_daily_snapshot_availability.md');
const TIMESTAMP_CSV = path.join(OUTPUT_DIR, 'poc_option_daily_snapshot_timestamp_summary.csv');
const FIELD_CSV = path.join(OUTPUT_DIR, 'poc_option_daily_snapshot_field_summary.csv');

const DERIBIT_API = 'https://www.deribit.com/api/v2';
const SNAPSHOT_TIMES_UTC = ['08:00', '14:00', '16:00'];
const MARK_LOOKAROUND_MS = 5 * 60 * 1000;
const RECENT_TRADE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const REQUEST_PAUSE_MS = Number(process.env.DERIBIT_POC_PAUSE_MS || 0);
const REQUEST_TIMEOUT_MS = Number(process.env.DERIBIT_POC_TIMEOUT_MS || 15000);
const REQUEST_CONCURRENCY = Number(process.env.DERIBIT_POC_CONCURRENCY || 6);

const OUTPUT_COLUMNS = [
  'date',
  'snapshot_time_utc',
  'instrument_name',
  'cycle',
  'entry_date',
  'exit_date',
  'expiry',
  'strike',
  'snapshot_found',
  'mark_price_found',
  'mark_price',
  'mark_iv_found',
  'mark_iv',
  'delta_found',
  'delta',
  'gamma_found',
  'gamma',
  'theta_found',
  'theta',
  'vega_found',
  'vega',
  'underlying_price_found',
  'underlying_price',
  'option_trade_candle_found',
  'option_trade_close',
  'recent_trade_found',
  'recent_trade_count',
  'api_timestamp',
  'api_timestamp_iso',
  'timestamp_diff_ms',
  'missing_fields',
  'notes'
];

const REQUIRED_FIELDS = [
  'mark_price',
  'mark_iv',
  'delta',
  'gamma',
  'theta',
  'vega',
  'underlying_price'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pct(numerator, denominator) {
  return denominator ? numerator / denominator * 100 : 0;
}

function round(value, decimals = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

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
  return lines.slice(1).filter(Boolean).map(line => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] === '' ? null : values[index];
    });
    return row;
  });
}

function csvValue(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const lines = [columns.join(',')];
  rows.forEach(row => lines.push(columns.map(column => csvValue(row[column])).join(',')));
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function dateLabel(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function snapshotTimestamp(date, timeUtc) {
  return Date.parse(`${date}T${timeUtc}:00.000Z`);
}

function uniqueObservedOptionTrades(rows) {
  return rows
    .filter(row => row.option_instrument && row.option_instrument.startsWith('BTC-'))
    .map(row => ({
      cycle: Number(row.cycle),
      entryDate: row.entry_date,
      exitDate: row.exit_date,
      expiry: row.expiry,
      instrumentName: row.option_instrument,
      strike: Number(row.strike),
      entryTimestamp: Date.parse(row.entry_date),
      exitTimestamp: Date.parse(row.exit_date)
    }));
}

function buildSnapshotRequests(trades) {
  const requests = [];
  const seen = new Set();

  for (const trade of trades) {
    const current = new Date(trade.entryTimestamp);
    current.setUTCHours(0, 0, 0, 0);

    while (current.getTime() < trade.exitTimestamp) {
      const day = current.toISOString().slice(0, 10);
      for (const timeUtc of SNAPSHOT_TIMES_UTC) {
        const timestamp = snapshotTimestamp(day, timeUtc);
        if (timestamp < trade.entryTimestamp || timestamp >= trade.exitTimestamp) continue;
        const key = `${trade.instrumentName}|${timestamp}`;
        if (seen.has(key)) continue;
        seen.add(key);
        requests.push({ ...trade, date: day, snapshotTimeUtc: timeUtc, timestamp });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return requests.sort((a, b) => a.timestamp - b.timestamp || a.instrumentName.localeCompare(b.instrumentName));
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
  const responseText = await response.text();
  let payload = null;
  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const apiMessage = payload && payload.error
      ? `${payload.error.message}${payload.error.data ? `:${JSON.stringify(payload.error.data)}` : ''}`
      : responseText.slice(0, 250);
    throw new Error(`${method} HTTP ${response.status} ${response.statusText}${apiMessage ? ` ${apiMessage}` : ''}`);
  }
  if (payload.error) {
    throw new Error(`${method} ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

async function deribitGetWithRetry(method, params, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await deribitGet(method, params);
    } catch (error) {
      lastError = error;
      const retryable = /HTTP 429|timed out|fetch failed/i.test(error.message || '');
      if (!retryable || attempt === retries) break;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

async function getMarkSnapshot(instrumentName, timestamp) {
  const result = await deribitGetWithRetry('public/get_mark_price_history', {
    instrument_name: instrumentName,
    start_timestamp: String(timestamp - MARK_LOOKAROUND_MS),
    end_timestamp: String(timestamp + MARK_LOOKAROUND_MS)
  });

  const points = Array.isArray(result) ? result : [];
  const valid = points
    .filter(point => Array.isArray(point) && point.length >= 2)
    .map(([ts, price]) => ({ timestamp: Number(ts), price: Number(price) }))
    .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.price))
    .sort((a, b) => Math.abs(a.timestamp - timestamp) - Math.abs(b.timestamp - timestamp));

  return valid[0] || null;
}

async function getTradingviewCandle(instrumentName, timestamp, resolution = 60) {
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
  return {
    timestamp: Number(result.ticks[i]),
    open: Number(result.open[i]),
    high: Number(result.high[i]),
    low: Number(result.low[i]),
    close: Number(result.close[i]),
    volume: Number(result.volume[i])
  };
}

async function getRecentTrades(instrumentName, timestamp) {
  const result = await deribitGetWithRetry('public/get_last_trades_by_instrument_and_time', {
    instrument_name: instrumentName,
    start_timestamp: String(timestamp - RECENT_TRADE_LOOKBACK_MS),
    end_timestamp: String(timestamp),
    count: '100',
    include_old: 'true',
    sorting: 'desc'
  });
  const trades = result && Array.isArray(result.trades) ? result.trades : Array.isArray(result) ? result : [];
  return trades.filter(trade => Number.isFinite(Number(trade.timestamp)));
}

function markEndpointLimitationNote() {
  return 'Deribit public/get_mark_price_history returns mark price only and only for a subset of options used in volatility index calculations.';
}

function greekEndpointLimitationNote() {
  return 'Deribit public/ticker exposes mark_iv and greeks for current/live instruments, but no official public historical point-in-time IV/Greek snapshot endpoint was found.';
}

async function evaluateRequest(request, underlyingCache) {
  const notes = [];
  let markPoint = null;
  let optionCandle = null;
  let underlyingCandle = null;
  let recentTrades = [];

  const underlyingKey = String(request.timestamp);
  const underlyingPromise = underlyingCache.has(underlyingKey)
    ? Promise.resolve(underlyingCache.get(underlyingKey))
    : getTradingviewCandle('BTC-PERPETUAL', request.timestamp, 60)
      .then(candle => {
        underlyingCache.set(underlyingKey, candle);
        return candle;
      })
      .catch(error => {
        notes.push(`underlying_ohlc_error:${error.message}`);
        underlyingCache.set(underlyingKey, null);
        return null;
      });

  await Promise.all([
    getMarkSnapshot(request.instrumentName, request.timestamp)
      .then(point => { markPoint = point; })
      .catch(error => { notes.push(`mark_history_error:${error.message}`); }),
    getTradingviewCandle(request.instrumentName, request.timestamp, 60)
      .then(candle => { optionCandle = candle; })
      .catch(error => { notes.push(`option_ohlc_error:${error.message}`); }),
    getRecentTrades(request.instrumentName, request.timestamp)
      .then(trades => { recentTrades = trades; })
      .catch(error => { notes.push(`recent_trade_error:${error.message}`); }),
    underlyingPromise.then(candle => { underlyingCandle = candle; })
  ]);

  if (REQUEST_PAUSE_MS > 0) {
    await sleep(REQUEST_PAUSE_MS);
  }

  const markPriceFound = Boolean(markPoint);
  const underlyingPriceFound = Boolean(underlyingCandle && Number.isFinite(underlyingCandle.close));
  const optionTradeCandleFound = Boolean(optionCandle && Number.isFinite(optionCandle.close));
  const recentTradeFound = recentTrades.length > 0;
  const timestampDiffMs = markPoint ? markPoint.timestamp - request.timestamp : null;

  if (markPriceFound && !recentTradeFound) {
    notes.push('mark_exists_without_recent_trade_24h');
  }
  if (!markPriceFound && optionTradeCandleFound) {
    notes.push('trade_candle_exists_but_mark_history_missing');
  }
  if (!markPriceFound) {
    notes.push(markEndpointLimitationNote());
  }
  notes.push(greekEndpointLimitationNote());

  const found = {
    mark_price: markPriceFound,
    mark_iv: false,
    delta: false,
    gamma: false,
    theta: false,
    vega: false,
    underlying_price: underlyingPriceFound
  };
  const missingFields = REQUIRED_FIELDS.filter(field => !found[field]);

  return {
    date: request.date,
    snapshot_time_utc: request.snapshotTimeUtc,
    instrument_name: request.instrumentName,
    cycle: request.cycle,
    entry_date: request.entryDate,
    exit_date: request.exitDate,
    expiry: request.expiry,
    strike: request.strike,
    snapshot_found: markPriceFound,
    mark_price_found: markPriceFound,
    mark_price: markPoint ? markPoint.price : null,
    mark_iv_found: false,
    mark_iv: null,
    delta_found: false,
    delta: null,
    gamma_found: false,
    gamma: null,
    theta_found: false,
    theta: null,
    vega_found: false,
    vega: null,
    underlying_price_found: underlyingPriceFound,
    underlying_price: underlyingPriceFound ? underlyingCandle.close : null,
    option_trade_candle_found: optionTradeCandleFound,
    option_trade_close: optionTradeCandleFound ? optionCandle.close : null,
    recent_trade_found: recentTradeFound,
    recent_trade_count: recentTrades.length,
    api_timestamp: markPoint ? markPoint.timestamp : null,
    api_timestamp_iso: markPoint ? new Date(markPoint.timestamp).toISOString() : null,
    timestamp_diff_ms: timestampDiffMs,
    missing_fields: missingFields,
    notes
  };
}

function summarizeTimestamp(rows) {
  return SNAPSHOT_TIMES_UTC.map(timeUtc => {
    const group = rows.filter(row => row.snapshot_time_utc === timeUtc);
    const successful = group.filter(row => row.snapshot_found).length;
    const greekComplete = group.filter(row => row.delta_found && row.gamma_found && row.theta_found && row.vega_found).length;
    const markWithoutRecentTrade = group.filter(row => row.mark_price_found && !row.recent_trade_found).length;
    const avgAbsTimestampDiffMs = group
      .map(row => Math.abs(Number(row.timestamp_diff_ms)))
      .filter(Number.isFinite);
    return {
      snapshot_time_utc: timeUtc,
      total_requests: group.length,
      successful_snapshots: successful,
      availability_pct: round(pct(successful, group.length)),
      mark_price_availability_pct: round(pct(group.filter(row => row.mark_price_found).length, group.length)),
      underlying_price_availability_pct: round(pct(group.filter(row => row.underlying_price_found).length, group.length)),
      greek_completeness_pct: round(pct(greekComplete, group.length)),
      option_trade_candle_availability_pct: round(pct(group.filter(row => row.option_trade_candle_found).length, group.length)),
      recent_trade_availability_pct: round(pct(group.filter(row => row.recent_trade_found).length, group.length)),
      marks_without_recent_trade_24h: markWithoutRecentTrade,
      avg_abs_timestamp_diff_ms: avgAbsTimestampDiffMs.length
        ? round(avgAbsTimestampDiffMs.reduce((sum, value) => sum + value, 0) / avgAbsTimestampDiffMs.length, 2)
        : null
    };
  }).sort((a, b) =>
    b.availability_pct - a.availability_pct ||
    b.underlying_price_availability_pct - a.underlying_price_availability_pct ||
    String(a.snapshot_time_utc).localeCompare(String(b.snapshot_time_utc))
  ).map((row, index) => ({ ...row, quality_rank: index + 1 }));
}

function summarizeFields(rows) {
  return REQUIRED_FIELDS.map(field => {
    const foundKey = `${field}_found`;
    const found = rows.filter(row => row[foundKey]).length;
    return {
      field,
      found_count: found,
      missing_count: rows.length - found,
      found_pct: round(pct(found, rows.length)),
      missing_pct: round(pct(rows.length - found, rows.length))
    };
  });
}

function buildSummary(rows, trades, requests) {
  const successful = rows.filter(row => row.snapshot_found).length;
  const greekComplete = rows.filter(row => row.delta_found && row.gamma_found && row.theta_found && row.vega_found).length;
  const markWithoutRecentTrade = rows.filter(row => row.mark_price_found && !row.recent_trade_found).length;
  const timestampSummary = summarizeTimestamp(rows);
  const fieldSummary = summarizeFields(rows);
  const firstMark = rows.find(row => row.mark_price_found);
  const lastMark = rows.slice().reverse().find(row => row.mark_price_found);
  const errors = rows.flatMap(row => row.notes).filter(note => /_error:/.test(note));
  const markHistoryErrors = rows
    .flatMap(row => row.notes)
    .filter(note => note.startsWith('mark_history_error:'));
  const markHistoryFailureReasons = Object.entries(markHistoryErrors.reduce((counts, note) => {
    const reason = note.includes('"instrument is not active"') || note.includes('instrument is not active')
      ? 'instrument_is_not_active'
      : note.includes('HTTP 400')
        ? 'http_400_bad_request'
        : note.replace(/^mark_history_error:/, '').slice(0, 120);
    counts[reason] = (counts[reason] || 0) + 1;
    return counts;
  }, {})).map(([reason, count]) => ({
    reason,
    count,
    pct_of_requests: round(pct(count, rows.length))
  })).sort((a, b) => b.count - a.count);

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      asset: 'BTC',
      tenor: 'weekly',
      moneyness: 'OTM10',
      year: 2025,
      runPath: path.relative(REPO_ROOT, RUN_DIR),
      sourceTradesCsv: path.relative(REPO_ROOT, TRADES_CSV),
      snapshotTimesUtc: SNAPSHOT_TIMES_UTC,
      observedOptionTradesOnly: true
    },
    methodology: {
      snapshotConstruction: 'For each observed option instrument in the existing 2025 weekly OTM10 run, request daily snapshots at 08:00, 14:00, and 16:00 UTC from entry timestamp inclusive to exit timestamp exclusive.',
      markPrice: 'Uses Deribit public/get_mark_price_history with a +/- 5 minute window and selects the closest returned mark point.',
      tradePresence: 'Uses public/get_tradingview_chart_data at 1-minute resolution plus public/get_last_trades_by_instrument_and_time over the trailing 24 hours.',
      underlyingPrice: 'Uses public/get_tradingview_chart_data for BTC-PERPETUAL at 1-minute resolution.',
      markIvAndGreeks: 'Marked unavailable because Deribit public historical mark history returns mark prices only; current public/ticker is not a historical point-in-time endpoint.'
    },
    limitations: [
      markEndpointLimitationNote(),
      greekEndpointLimitationNote(),
      'This POC does not reconstruct Greeks from Black-Scholes; it tests whether official historical point-in-time values are directly obtainable.',
      'The run has synthetic fallback cycles with no observed option_instrument; those are excluded because there is no exact traded option to query.',
      'If Deribit returns empty mark history for an instrument, this script records that as unavailable rather than substituting trade OHLC as a mark.'
    ],
    metrics: {
      observedOptionTrades: trades.length,
      totalSnapshotRequests: requests.length,
      successfulSnapshots: successful,
      availabilityPct: round(pct(successful, rows.length)),
      greekCompleteSnapshots: greekComplete,
      greekCompletenessPct: round(pct(greekComplete, rows.length)),
      markPriceAvailabilityPct: round(pct(rows.filter(row => row.mark_price_found).length, rows.length)),
      markIvAvailabilityPct: round(pct(rows.filter(row => row.mark_iv_found).length, rows.length)),
      underlyingPriceAvailabilityPct: round(pct(rows.filter(row => row.underlying_price_found).length, rows.length)),
      optionTradeCandleAvailabilityPct: round(pct(rows.filter(row => row.option_trade_candle_found).length, rows.length)),
      recentTradeAvailabilityPct: round(pct(rows.filter(row => row.recent_trade_found).length, rows.length)),
      marksWithoutRecentTrade24h: markWithoutRecentTrade,
      marksWithoutRecentTrade24hPctOfMarks: round(pct(markWithoutRecentTrade, rows.filter(row => row.mark_price_found).length)),
      firstAvailableMarkTimestamp: firstMark ? firstMark.api_timestamp_iso : null,
      lastAvailableMarkTimestamp: lastMark ? lastMark.api_timestamp_iso : null,
      markHistoryFailureReasons,
      apiErrorCount: errors.length
    },
    timestampQualityRanking: timestampSummary,
    missingRateByField: fieldSummary,
    feasibilityAssessment: {
      exactOptionSnapshotsRetrievable: successful > 0,
      officialHistoricalMarksUsableForDailyMtm: successful / Math.max(rows.length, 1) >= 0.9,
      officialHistoricalGreeksUsableForDailyMtm: false,
      officialOptionTradeOhlcUsableAsMarkProxy: false,
      likelyExternalProviderNeed: 'High for historical IV/Greeks and broad option-chain snapshots. Providers such as Tardis or other Deribit historical options vendors would likely solve this if they store full ticker/order-book snapshots with mark_iv, greeks, underlying/index price, and timestamps.'
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
  const metrics = summary.metrics;
  const best = summary.timestampQualityRanking[0];

  return [
    '# Option Daily Snapshot Availability POC',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Scope',
    '',
    `- Asset: ${summary.scope.asset}`,
    `- Tenor/moneyness/year: ${summary.scope.tenor} ${summary.scope.moneyness} ${summary.scope.year}`,
    `- Source run: ${summary.scope.runPath}`,
    `- Snapshot times: ${summary.scope.snapshotTimesUtc.join(', ')} UTC`,
    '- Purpose: data-availability validation only; no MTM framework, hedge logic, or backtest rerun.',
    '',
    '## Results',
    '',
    `- Observed option trades tested: ${metrics.observedOptionTrades}`,
    `- Total snapshot attempts: ${metrics.totalSnapshotRequests}`,
    `- Successful historical mark snapshots: ${metrics.successfulSnapshots} (${metrics.availabilityPct}%)`,
    `- Greek completeness: ${metrics.greekCompleteSnapshots} (${metrics.greekCompletenessPct}%)`,
    `- Underlying price availability: ${metrics.underlyingPriceAvailabilityPct}%`,
    `- Option trade OHLC availability: ${metrics.optionTradeCandleAvailabilityPct}%`,
    `- Recent trade endpoint availability: ${metrics.recentTradeAvailabilityPct}%`,
    `- Best timestamp by mark availability: ${best ? `${best.snapshot_time_utc} UTC (${best.availability_pct}%)` : 'n/a'}`,
    `- Marks without recent trade in trailing 24h: ${metrics.marksWithoutRecentTrade24h} (${metrics.marksWithoutRecentTrade24hPctOfMarks}% of marks)`,
    '',
    '## Mark History Failure Reasons',
    '',
    markdownTable(metrics.markHistoryFailureReasons, [
      'reason',
      'count',
      'pct_of_requests'
    ]),
    '',
    '## Timestamp Comparison',
    '',
    markdownTable(summary.timestampQualityRanking, [
      'quality_rank',
      'snapshot_time_utc',
      'total_requests',
      'successful_snapshots',
      'availability_pct',
      'underlying_price_availability_pct',
      'greek_completeness_pct',
      'recent_trade_availability_pct',
      'marks_without_recent_trade_24h'
    ]),
    '',
    '## Missing Rate By Field',
    '',
    markdownTable(summary.missingRateByField, [
      'field',
      'found_count',
      'missing_count',
      'found_pct',
      'missing_pct'
    ]),
    '',
    '## Interpretation',
    '',
    `- Exact option snapshots retrievable: ${summary.feasibilityAssessment.exactOptionSnapshotsRetrievable ? 'yes, for at least some requested marks' : 'no successful historical mark snapshots were retrieved'}.`,
    `- Official historical marks usable for full daily MTM: ${summary.feasibilityAssessment.officialHistoricalMarksUsableForDailyMtm ? 'likely yes for this slice' : 'not proven by this slice; coverage is below the 90% practical threshold used by this POC'}.`,
    '- Official historical Greeks usable for daily MTM: no. Deribit public historical mark history does not include mark IV or Greeks, and public/ticker is current/live rather than historical point-in-time.',
    '- Trade OHLC can be retrieved for these exact expired options, but this POC does not treat trade OHLC as a mark-price substitute because it lacks mark IV, Greeks, timestamped theoretical valuation, and quote/mark semantics.',
    '- Major retention/API gap: public/get_mark_price_history rejected every tested expired exact instrument as inactive, so the official mark endpoint did not support this 2025 reconstruction slice.',
    `- External provider need: ${summary.feasibilityAssessment.likelyExternalProviderNeed}`,
    '',
    '## Limitations',
    '',
    ...summary.limitations.map(item => `- ${item}`),
    '',
    '## Deribit API References',
    '',
    '- https://docs.deribit.com/api-reference/market-data/public-get_mark_price_history',
    '- https://docs.deribit.com/api-reference/market-data/public-ticker',
    ''
  ].join('\n');
}

function printSummary(summary) {
  const best = summary.timestampQualityRanking[0];
  console.log('\n=== POC SUMMARY ===');
  console.log(`Total snapshot attempts: ${summary.metrics.totalSnapshotRequests}`);
  console.log(`Availability: ${summary.metrics.availabilityPct}% (${summary.metrics.successfulSnapshots}/${summary.metrics.totalSnapshotRequests})`);
  console.log(`Best timestamp: ${best ? `${best.snapshot_time_utc} UTC (${best.availability_pct}%)` : 'n/a'}`);
  console.log(`Greek completeness: ${summary.metrics.greekCompletenessPct}%`);
  console.log(`Underlying availability: ${summary.metrics.underlyingPriceAvailabilityPct}%`);
  console.log(`Marks without recent trade 24h: ${summary.metrics.marksWithoutRecentTrade24h}`);
  console.log('\nMissing rates:');
  summary.missingRateByField.forEach(row => {
    console.log(`- ${row.field}: ${row.missing_pct}% missing`);
  });
  console.log('\nFeasibility:');
  console.log(`- Official historical marks usable: ${summary.feasibilityAssessment.officialHistoricalMarksUsableForDailyMtm}`);
  console.log(`- Official historical Greeks usable: ${summary.feasibilityAssessment.officialHistoricalGreeksUsableForDailyMtm}`);
}

async function main() {
  const inputRows = readCsv(TRADES_CSV);
  const trades = uniqueObservedOptionTrades(inputRows);
  const requests = buildSnapshotRequests(trades);
  const underlyingCache = new Map();
  const rows = [];

  console.log(`Loaded ${inputRows.length} trade rows from ${path.relative(REPO_ROOT, TRADES_CSV)}`);
  console.log(`Testing ${trades.length} observed option instruments across ${requests.length} snapshot attempts.`);

  let nextIndex = 0;
  let completed = 0;
  async function worker() {
    while (nextIndex < requests.length) {
      const index = nextIndex;
      nextIndex += 1;
      const request = requests[index];
      const row = await evaluateRequest(request, underlyingCache);
      rows[index] = row;
      completed += 1;
      if (completed === 1 || completed % 25 === 0 || completed === requests.length) {
        console.log(`Completed ${completed}/${requests.length}; latest ${request.date} ${request.snapshotTimeUtc} ${request.instrumentName}`);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(REQUEST_CONCURRENCY, requests.length));
  console.log(`Using request concurrency: ${workerCount}; HTTP timeout: ${REQUEST_TIMEOUT_MS}ms`);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const summary = buildSummary(rows, trades, requests);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  writeCsv(OUTPUT_CSV, rows, OUTPUT_COLUMNS);
  writeCsv(TIMESTAMP_CSV, summary.timestampQualityRanking, [
    'quality_rank',
    'snapshot_time_utc',
    'total_requests',
    'successful_snapshots',
    'availability_pct',
    'mark_price_availability_pct',
    'underlying_price_availability_pct',
    'greek_completeness_pct',
    'option_trade_candle_availability_pct',
    'recent_trade_availability_pct',
    'marks_without_recent_trade_24h',
    'avg_abs_timestamp_diff_ms'
  ]);
  writeCsv(FIELD_CSV, summary.missingRateByField, [
    'field',
    'found_count',
    'missing_count',
    'found_pct',
    'missing_pct'
  ]);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify({ ...summary, rows }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, buildMarkdown(summary), 'utf8');

  console.log(`\nWrote ${path.relative(REPO_ROOT, OUTPUT_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_MD)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, TIMESTAMP_CSV)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, FIELD_CSV)}`);
  printSummary(summary);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Error running option daily snapshot availability POC:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildSnapshotRequests,
  buildSummary,
  parseCsvLine,
  uniqueObservedOptionTrades
};
