const fs = require('fs');
const https = require('https');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber
} = require('./btc_deep_risk_utils');

const LIVE_DATA_DIR = path.join(REPO_ROOT, 'live', 'data');
const OUTPUT_JSON = path.join(LIVE_DATA_DIR, 'live_option_discovery.json');
const TARGET_MONEYNESS = 1.05;
const EXPIRY_WINDOW_MIN_DAYS = 6;
const EXPIRY_WINDOW_MAX_DAYS = 9;

const ASSETS = [
  {
    asset: 'BTC',
    baseCoin: 'BTC',
    metricsPath: path.join(LIVE_DATA_DIR, 'btc_live_metrics.json')
  },
  {
    asset: 'ETH',
    baseCoin: 'ETH',
    metricsPath: path.join(LIVE_DATA_DIR, 'eth_live_metrics.json')
  }
];

const DEBUG = process.argv.includes('--debug');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${url}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchBybitOptionInstruments(baseCoin) {
  const bySymbol = new Map();
  const requestSummaries = [];
  let serverTime = null;
  const statuses = [null, 'Trading', 'PreLaunch'];

  for (const status of statuses) {
    let cursor = '';
    do {
      const url = `https://api.bybit.com/v5/market/instruments-info?category=option&baseCoin=${baseCoin}&limit=1000${status ? `&status=${status}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const payload = await fetchJson(url);
      if (serverTime === null) serverTime = optionalNumber(payload.time);
      const result = payload.result || {};
      const list = Array.isArray(result.list) ? result.list : [];
      requestSummaries.push({ status: status || 'default', count: list.length, nextPageCursor: result.nextPageCursor || '' });
      for (const row of list) {
        if (row.symbol) bySymbol.set(row.symbol, row);
      }
      cursor = result.nextPageCursor || '';
    } while (cursor);
  }

  return {
    rows: [...bySymbol.values()],
    serverDate: serverTime === null ? null : new Date(serverTime).toISOString().slice(0, 10),
    requestSummaries
  };
}

async function fetchBybitOptionTicker(symbol) {
  const url = `https://api.bybit.com/v5/market/tickers?category=option&symbol=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  const row = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list[0]
    : null;
  return { endpoint: url, row };
}

async function fetchDeribitInstruments(asset) {
  const url = `https://www.deribit.com/api/v2/public/get_instruments?currency=${asset.baseCoin}&kind=option&expired=false`;
  const payload = await fetchJson(url);
  const rows = Array.isArray(payload.result) ? payload.result : [];
  return {
    endpoint: url,
    rows: rows.map(row => ({
      symbol: row.instrument_name,
      status: row.is_active === false ? 'Inactive' : 'Trading',
      baseCoin: asset.baseCoin,
      optionsType: String(row.option_type || '').toLowerCase() === 'call' ? 'Call' : row.option_type,
      deliveryTime: optionalNumber(row.expiration_timestamp),
      expiry: dateFromMillis(row.expiration_timestamp),
      strike: optionalNumber(row.strike)
    }))
  };
}

async function fetchDeribitOrderBook(symbol) {
  const url = `https://www.deribit.com/api/v2/public/get_order_book?instrument_name=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  return { endpoint: url, row: payload.result || null };
}

function dateFromMillis(value) {
  const number = optionalNumber(value);
  if (number === null) return null;
  return new Date(number).toISOString().slice(0, 10);
}

const MONTHS = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12'
};

function parseOptionSymbol(symbol) {
  const match = String(symbol || '').match(/^([A-Z]+)-(\d{1,2})([A-Z]{3})(\d{2})-(\d+(?:\.\d+)?)-([CP])(?:-[A-Z]+)?$/);
  if (!match) return {};
  const day = match[2].padStart(2, '0');
  const month = MONTHS[match[3]];
  const year = `20${match[4]}`;
  return {
    baseCoin: match[1],
    expiry: month ? `${year}-${month}-${day}` : null,
    strike: optionalNumber(match[5]),
    optionType: match[6] === 'C' ? 'Call' : 'Put'
  };
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function isFriday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 5;
}

function normalizeInstrument(row) {
  const parsed = parseOptionSymbol(row.symbol);
  const optionType = row.optionsType || row.optionType || row.option_type || parsed.optionType;
  const deliveryTime = optionalNumber(row.deliveryTime, row.expirationTime, row.expiryTime);
  return {
    symbol: row.symbol,
    status: row.status,
    baseCoin: row.baseCoin || parsed.baseCoin,
    optionsType: optionType,
    optionType,
    deliveryTime,
    expiry: dateFromMillis(deliveryTime) || parsed.expiry,
    strike: optionalNumber(row.strike, row.strikePrice, parsed.strike)
  };
}

function isCallOption(row) {
  return String(row.optionsType || row.optionType || '').toLowerCase() === 'call'
    || /-C(?:-[A-Z]+)?$/.test(String(row.symbol || ''));
}

function chooseInstrument(instruments, dataAsOf, targetStrikeRaw, serverDate, debugLabel) {
  const warnings = [];
  const normalized = instruments.map(normalizeInstrument);
  const calls = normalized
    .filter(row => row.symbol && isCallOption(row) && row.expiry && row.strike !== null)
    .filter(row => !row.status || !['Settled', 'Delivering', 'Closed'].includes(row.status));

  if (DEBUG && debugLabel) {
    const expiries = [...new Set(calls.map(row => row.expiry))].sort();
    console.log(`[debug] ${debugLabel}: normalized call count=${calls.length}`);
    console.log(`[debug] ${debugLabel}: first 5 normalized calls=${JSON.stringify(calls.slice(0, 5), null, 2)}`);
    console.log(`[debug] ${debugLabel}: available expiries=${expiries.join(', ') || 'none'}`);
    console.log(`[debug] ${debugLabel}: target DTE window=${EXPIRY_WINDOW_MIN_DAYS}-${EXPIRY_WINDOW_MAX_DAYS}`);
  }

  if (!calls.length) return { selected: null, warnings: ['No live call option instruments found in public Bybit instrument list.'] };

  let referenceDate = dataAsOf;
  let eligible = calls.filter(row => row.expiry > referenceDate);
  if (!eligible.length && serverDate && serverDate < dataAsOf) {
    referenceDate = serverDate;
    eligible = calls.filter(row => row.expiry > referenceDate);
    warnings.push(`Option chain selection used Bybit server date ${serverDate} because no instruments were listed after snapshot data_as_of ${dataAsOf}.`);
  }

  if (!eligible.length) return { selected: null, warnings: [...warnings, 'No live call option instruments found after the applicable reference date.'] };

  const expiries = [...new Set(eligible.map(row => row.expiry))].sort();
  const expiryRows = expiries.map(expiry => ({ expiry, dte: daysBetween(referenceDate, expiry) }))
    .filter(row => row.dte !== null && row.dte > 0);
  const weeklyExpiryRows = expiryRows.filter(row => isFriday(row.expiry));
  const windowExpiries = weeklyExpiryRows.filter(row => row.dte >= EXPIRY_WINDOW_MIN_DAYS && row.dte <= EXPIRY_WINDOW_MAX_DAYS);
  let selectedExpiryRow = null;
  let selectionMethod = 'weekly_window';

  if (windowExpiries.length) {
    selectedExpiryRow = windowExpiries[0];
  } else {
    selectedExpiryRow = weeklyExpiryRows[0] || null;
    selectionMethod = 'fallback_nearest_later_weekly_expiry';
    warnings.push(`No option expiry found inside the target ${EXPIRY_WINDOW_MIN_DAYS}-${EXPIRY_WINDOW_MAX_DAYS} day weekly window.`);
    if (selectedExpiryRow) {
      warnings.push('Used nearest later weekly Friday expiry as fallback.');
    }
  }

  if (!selectedExpiryRow) return { selected: null, warnings: [...warnings, 'No later weekly Friday option expiry found for selection.'] };

  const selectedExpiry = selectedExpiryRow.expiry;
  const expiryCalls = eligible.filter(row => row.expiry === selectedExpiry);
  const selected = expiryCalls.reduce((best, row) => {
    if (!best) return row;
    const bestDistance = Math.abs(best.strike - targetStrikeRaw);
    const rowDistance = Math.abs(row.strike - targetStrikeRaw);
    return rowDistance < bestDistance ? row : best;
  }, null);

  const result = {
    selected,
    warnings,
    selectionReferenceDate: referenceDate,
    daysToExpiration: selectedExpiryRow.dte,
    selectionMethod
  };
  if (DEBUG && debugLabel) {
    console.log(`[debug] ${debugLabel}: selected candidate=${JSON.stringify(result, null, 2)}`);
  }
  return result;
}

function premiumFromTicker(ticker) {
  const bid = optionalNumber(ticker && ticker.bid1Price, ticker && ticker.bidPrice);
  const ask = optionalNumber(ticker && ticker.ask1Price, ticker && ticker.askPrice);
  const mark = optionalNumber(ticker && ticker.markPrice);
  const last = optionalNumber(ticker && ticker.lastPrice);
  const mid = bid !== null && ask !== null && ask >= bid ? (bid + ask) / 2 : null;

  if (mid !== null) return { premium: roundNumber(mid), source: 'bybit_bid_ask_mid' };
  if (mark !== null) return { premium: roundNumber(mark), source: 'bybit_mark_price' };
  if (last !== null) return { premium: roundNumber(last), source: 'bybit_last_price' };
  return { premium: null, source: null };
}

function premiumFromDeribitOrderBook(orderBook, underlyingPrice) {
  const bid = optionalNumber(orderBook && orderBook.best_bid_price);
  const ask = optionalNumber(orderBook && orderBook.best_ask_price);
  const mark = optionalNumber(orderBook && orderBook.mark_price);
  const last = optionalNumber(orderBook && orderBook.last_price);
  const mid = bid !== null && ask !== null && ask >= bid ? (bid + ask) / 2 : null;
  const sourceValue = mid !== null
    ? { premium: mid, source: 'deribit_bid_ask_mid_underlying' }
    : mark !== null
      ? { premium: mark, source: 'deribit_mark_price_underlying' }
      : last !== null
        ? { premium: last, source: 'deribit_last_price_underlying' }
        : { premium: null, source: null };
  if (sourceValue.premium === null || underlyingPrice === null) return sourceValue;
  return {
    premium: roundNumber(sourceValue.premium * underlyingPrice),
    source: `${sourceValue.source}_converted_to_usd`
  };
}

function convertUnderlyingQuoteToUsd(value, underlyingPrice) {
  const number = optionalNumber(value);
  const spot = optionalNumber(underlyingPrice);
  return number === null || spot === null ? null : number * spot;
}

async function discoverAsset(asset) {
  if (!fs.existsSync(asset.metricsPath)) throw new Error(`Missing live metrics ${asset.metricsPath}`);

  const metrics = readJson(asset.metricsPath);
  const underlyingPrice = optionalNumber(metrics.current_price);
  const dataAsOf = metrics.data_as_of || metrics.snapshot_date;
  const warnings = [];
  if (underlyingPrice === null) warnings.push('Underlying live price unavailable.');
  if (!dataAsOf) warnings.push('Live metrics data_as_of unavailable.');

  const instruments = await fetchBybitOptionInstruments(asset.baseCoin);
  if (DEBUG) {
    console.log(`[debug] ${asset.asset}: Bybit request summaries=${JSON.stringify(instruments.requestSummaries)}`);
    console.log(`[debug] ${asset.asset}: Bybit raw instrument count=${instruments.rows.length}`);
    console.log(`[debug] ${asset.asset}: first 5 raw instruments=${JSON.stringify(instruments.rows.slice(0, 5), null, 2)}`);
  }
  const targetStrikeRaw = underlyingPrice === null ? null : underlyingPrice * TARGET_MONEYNESS;
  let venue = 'Bybit';
  let source = 'bybit_public_option_instruments_and_ticker';
  let choice = targetStrikeRaw === null || !dataAsOf
    ? { selected: null, warnings: ['Cannot select option without underlying price and data_as_of.'] }
    : chooseInstrument(instruments.rows, dataAsOf, targetStrikeRaw, instruments.serverDate, `${asset.asset} Bybit`);
  warnings.push(...choice.warnings);

  let tickerResult = { endpoint: null, row: null };
  let premium = { premium: null, source: null };
  let optionBid = null;
  let optionAsk = null;
  let optionMark = null;
  let optionLast = null;

  if (choice.selected) {
    tickerResult = await fetchBybitOptionTicker(choice.selected.symbol);
    premium = premiumFromTicker(tickerResult.row);
    optionBid = optionalNumber(tickerResult.row && tickerResult.row.bid1Price, tickerResult.row && tickerResult.row.bidPrice);
    optionAsk = optionalNumber(tickerResult.row && tickerResult.row.ask1Price, tickerResult.row && tickerResult.row.askPrice);
    optionMark = optionalNumber(tickerResult.row && tickerResult.row.markPrice);
    optionLast = optionalNumber(tickerResult.row && tickerResult.row.lastPrice);
  }

  let deribitEndpoint = null;
  if (!choice.selected && targetStrikeRaw !== null && dataAsOf) {
    const deribit = await fetchDeribitInstruments(asset);
    deribitEndpoint = deribit.endpoint;
    choice = chooseInstrument(deribit.rows, dataAsOf, targetStrikeRaw, instruments.serverDate, `${asset.asset} Deribit`);
    if (choice.selected) {
      venue = 'Deribit';
      source = 'deribit_public_option_instruments_and_order_book';
      warnings.push(...choice.warnings);
      warnings.push('Bybit option discovery unavailable; used Deribit public option fallback.');
      tickerResult = await fetchDeribitOrderBook(choice.selected.symbol);
      premium = premiumFromDeribitOrderBook(tickerResult.row, underlyingPrice);
      optionBid = convertUnderlyingQuoteToUsd(tickerResult.row && tickerResult.row.best_bid_price, underlyingPrice);
      optionAsk = convertUnderlyingQuoteToUsd(tickerResult.row && tickerResult.row.best_ask_price, underlyingPrice);
      optionMark = convertUnderlyingQuoteToUsd(tickerResult.row && tickerResult.row.mark_price, underlyingPrice);
      optionLast = convertUnderlyingQuoteToUsd(tickerResult.row && tickerResult.row.last_price, underlyingPrice);
    } else {
      warnings.push(...choice.warnings.map(warning => `Deribit fallback: ${warning}`));
    }
  }

  if (choice.selected && premium.premium === null) {
    warnings.push('Observed option premium unavailable from public ticker fields.');
  }

  return {
    asset: asset.asset,
    venue,
    source,
    generated_at: new Date().toISOString(),
    data_as_of: dataAsOf,
    underlying_price: roundNumber(underlyingPrice),
    target_moneyness: TARGET_MONEYNESS,
    target_strike_raw: roundNumber(targetStrikeRaw),
    selected_expiry: choice.selected ? choice.selected.expiry : null,
    selected_instrument: choice.selected ? choice.selected.symbol : null,
    selected_strike: choice.selected ? choice.selected.strike : null,
    selection_reference_date: choice.selectionReferenceDate || dataAsOf || null,
    days_to_expiration: choice.daysToExpiration ?? null,
    selection_method: choice.selectionMethod || null,
    expiry_window_min_days: EXPIRY_WINDOW_MIN_DAYS,
    expiry_window_max_days: EXPIRY_WINDOW_MAX_DAYS,
    bybit_server_date: instruments.serverDate,
    observed_premium: premium.premium,
    premium_source: premium.source,
    option_bid: roundNumber(optionBid),
    option_ask: roundNumber(optionAsk),
    option_mark_price: roundNumber(optionMark),
    option_last_price: roundNumber(optionLast),
    warnings,
    endpoints: {
      instruments: `https://api.bybit.com/v5/market/instruments-info?category=option&baseCoin=${asset.baseCoin}&limit=1000`,
      ticker: tickerResult.endpoint,
      deribit_instruments: deribitEndpoint
    }
  };
}

async function main() {
  fs.mkdirSync(LIVE_DATA_DIR, { recursive: true });
  const rows = [];
  for (const asset of ASSETS) {
    const row = await discoverAsset(asset);
    rows.push(row);
    console.log(`${row.asset}: ${row.selected_instrument || 'no_option'} premium=${row.observed_premium === null ? 'null' : row.observed_premium}`);
  }

  const payload = {
    generated_at: new Date().toISOString(),
    rows
  };
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_JSON)}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error refreshing live option discovery: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
