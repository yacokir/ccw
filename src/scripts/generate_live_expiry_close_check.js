const fs = require('fs');
const https = require('https');
const path = require('path');

const {
  REPO_ROOT,
  optionalNumber,
  roundNumber,
  readJson
} = require('./btc_deep_risk_utils');
const {
  BybitReadOnlyAccountClient,
  bybitConfigFromEnv,
  hasCredentials
} = require('./bybit_readonly_account_client');
const { fetchBybitAccountSync } = require('./bybit_account_sync');

const LIVE_DIR = path.join(REPO_ROOT, 'live');
const LIVE_DATA_DIR = path.join(LIVE_DIR, 'data');
const REPORTS_DIR = path.join(LIVE_DIR, 'reports');
const POSITION_REGISTER_PATH = path.join(LIVE_DIR, 'position_register.json');
const LIVE_POSITION_MONITORING_PATH = path.join(LIVE_DATA_DIR, 'live_position_monitoring.json');

function nyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const mapped = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers }, response => {
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
          const payload = JSON.parse(body);
          if (payload && payload.retCode !== undefined && payload.retCode !== 0) {
            reject(new Error(`Bybit retCode ${payload.retCode}: ${payload.retMsg || 'unknown error'}`));
            return;
          }
          resolve(payload);
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    request.setTimeout(15000, () => {
      request.destroy(new Error(`Timeout from ${url}`));
    });
    request.on('error', reject);
  });
}

async function fetchBybitTicker(category, symbol) {
  const url = `https://api.bybit.com/v5/market/tickers?category=${category}&symbol=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  const rows = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list
    : [];
  return { endpoint: url, row: rows[0] || null };
}

async function fetchBybitDeliveryPrice(symbol) {
  const url = `https://api.bybit.com/v5/market/delivery-price?category=option&symbol=${encodeURIComponent(symbol)}`;
  const payload = await fetchJson(url);
  const rows = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list
    : [];
  return { endpoint: url, row: rows[0] || null };
}

async function fetchTransactionLog(startDate, endDate, warnings) {
  if (!hasCredentials()) {
    return {
      available: false,
      rows: [],
      warnings: ['Bybit transaction log skipped: BYBIT_API_KEY or BYBIT_API_SECRET is not configured.']
    };
  }

  const config = bybitConfigFromEnv();
  const client = new BybitReadOnlyAccountClient(config);
  const startTime = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTime = new Date(`${endDate}T23:59:59Z`).getTime();
  try {
    const payload = await client.get('/v5/account/transaction-log', {
      accountType: 'UNIFIED',
      category: 'option',
      startTime,
      endTime,
      limit: 50
    });
    const rows = payload && payload.result && Array.isArray(payload.result.list)
      ? payload.result.list
      : [];
    return {
      available: true,
      rows,
      warnings: [],
      environment: config.environment,
      base_url: config.baseUrl
    };
  } catch (error) {
    warnings.push(`Bybit transaction log unavailable: ${error.message}`);
    return {
      available: false,
      rows: [],
      warnings: [`Bybit transaction log unavailable: ${error.message}`],
      environment: config.environment,
      base_url: config.baseUrl
    };
  }
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function parseDateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function addDays(dateValue, days) {
  const base = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return dateValue;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function isOnOrAfter(dateA, dateB) {
  const a = parseDateOnly(dateA);
  const b = parseDateOnly(dateB);
  return Boolean(a && b && a >= b);
}

function loadPositionRegister() {
  if (!fs.existsSync(POSITION_REGISTER_PATH)) {
    throw new Error(`Missing Position Register: ${path.relative(REPO_ROOT, POSITION_REGISTER_PATH)}`);
  }
  const payload = readJson(POSITION_REGISTER_PATH);
  const positions = Array.isArray(payload.positions) ? payload.positions : [];
  const active = positions.filter(position => String(position.status || position.position_status || '').toUpperCase() === 'ACTIVE');
  if (!active.length) {
    throw new Error('Position Register has no ACTIVE positions for expiry close check.');
  }
  return { payload, positions: active };
}

function loadMonitoringRows() {
  if (!fs.existsSync(LIVE_POSITION_MONITORING_PATH)) return new Map();
  const payload = readJson(LIVE_POSITION_MONITORING_PATH);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return new Map(rows.filter(row => row.asset).map(row => [row.asset, row]));
}

function normalizePosition(position) {
  const optionEntryPremium = optionalNumber(position.option_entry_premium, position.short_call_entry_premium);
  const optionQty = optionalNumber(position.option_qty, position.short_call_qty);
  const underlyingEntryPrice = optionalNumber(
    position.underlying_entry_price,
    position.underlying_cost_basis && position.underlying_cost_basis.average_entry_price
  );
  return {
    ...position,
    status: firstValue(position.status, position.position_status),
    option_instrument: firstValue(position.option_instrument, position.short_call_symbol),
    option_expiry: firstValue(position.option_expiry, position.short_call_expiry),
    option_strike: optionalNumber(position.option_strike, position.short_call_strike),
    option_qty: optionQty,
    option_entry_premium: optionEntryPremium,
    premium_received: optionEntryPremium === null || optionQty === null
      ? null
      : roundNumber(Math.abs(optionQty) * optionEntryPremium),
    hedge_qty: optionalNumber(position.hedge_qty),
    hedge_entry_price: optionalNumber(position.hedge_entry_price),
    underlying_qty: optionalNumber(position.underlying_qty),
    underlying_entry_price: underlyingEntryPrice
  };
}

function spotHolding(accountSync, asset) {
  if (!accountSync || !Array.isArray(accountSync.spot_holdings)) return null;
  return accountSync.spot_holdings.find(row => row.asset === asset) || null;
}

function hedgePosition(accountSync, symbol) {
  if (!accountSync || !Array.isArray(accountSync.perpetual_positions) || !symbol) return null;
  return accountSync.perpetual_positions.find(row => row.symbol === symbol) || null;
}

function optionPosition(accountSync, symbol) {
  if (!accountSync || !Array.isArray(accountSync.option_positions) || !symbol) return null;
  return accountSync.option_positions.find(row => row.symbol === symbol) || null;
}

function transactionMatchesInstrument(row, instrument) {
  const blob = JSON.stringify(row || {}).toUpperCase();
  return instrument && blob.includes(String(instrument).toUpperCase());
}

function deliveryTransactionsFor(rows, instrument) {
  return (rows || []).filter(row => {
    const type = String(row.type || row.transactionType || '').toUpperCase();
    const isDelivery = type.includes('DELIVERY') || JSON.stringify(row).toUpperCase().includes('DELIVERY');
    return isDelivery && transactionMatchesInstrument(row, instrument);
  });
}

function deliveryPriceFromRow(row) {
  return optionalNumber(
    row && row.deliveryPrice,
    row && row.delivery_price,
    row && row.settlePrice,
    row && row.settlementPrice
  );
}

function deliveryTimeFromRow(row) {
  const raw = firstValue(row && row.deliveryTime, row && row.delivery_time, row && row.time);
  if (raw === null) return null;
  const number = optionalNumber(raw);
  if (number !== null) return new Date(number).toISOString();
  return String(raw);
}

function finalOptionState({ position, settlementPrice, finalSpot, transactionRows, accountSync, snapshotDate }) {
  const strike = optionalNumber(position.option_strike);
  const deliveryFound = transactionRows.length > 0;
  const liveOption = optionPosition(accountSync, position.option_instrument);
  const stillOpen = Boolean(liveOption);

  if (!position.option_expiry || strike === null) {
    return {
      state: 'unknown',
      confidence: 'low',
      manualReview: true,
      warnings: ['Option expiry or strike is unavailable.']
    };
  }
  if (!isOnOrAfter(snapshotDate, position.option_expiry)) {
    return {
      state: 'not expired',
      confidence: 'high',
      manualReview: true,
      warnings: ['Snapshot date is before option expiry.']
    };
  }
  if (stillOpen) {
    return {
      state: 'unknown',
      confidence: 'medium',
      manualReview: true,
      warnings: ['Account sync still shows an open option position after expiry date.']
    };
  }

  const settlement = optionalNumber(settlementPrice);
  if (settlement !== null) {
    if (settlement < strike) {
      return {
        state: deliveryFound ? 'expired OTM confirmed' : 'expired OTM confirmed by delivery price',
        confidence: deliveryFound ? 'high' : 'medium',
        manualReview: false,
        warnings: deliveryFound ? [] : ['No account delivery transaction matched the instrument; public delivery price confirms OTM.']
      };
    }
    if (settlement > strike) {
      return {
        state: deliveryFound ? 'exercised / settled ITM confirmed' : 'expired ITM / exercise unknown',
        confidence: deliveryFound ? 'high' : 'medium',
        manualReview: true,
        warnings: deliveryFound ? [] : ['Public delivery price is above strike, but no matching delivery transaction was found.']
      };
    }
    return {
      state: 'expired ATM / exercise unknown',
      confidence: 'medium',
      manualReview: true,
      warnings: ['Public delivery price equals strike.']
    };
  }

  const spot = optionalNumber(finalSpot);
  if (spot !== null) {
    if (spot < strike) {
      return {
        state: 'expired OTM estimated',
        confidence: 'low',
        manualReview: false,
        warnings: ['Option state inferred from final spot below strike; no settlement/exercise record was used.']
      };
    }
    if (spot > strike) {
      return {
        state: 'expired ITM / exercise unknown',
        confidence: 'low',
        manualReview: true,
        warnings: ['Final spot is above strike and no settlement/exercise record was used.']
      };
    }
  }

  return {
    state: 'unknown',
    confidence: 'low',
    manualReview: true,
    warnings: ['Option state could not be inferred because settlement and final spot are unavailable.']
  };
}

function optionPnl(position, settlementPrice, state, finalSpot) {
  const qty = optionalNumber(position.option_qty);
  const entry = optionalNumber(position.option_entry_premium);
  if (qty === null || entry === null) return { value: null, finalMark: null, method: null };

  const settlement = optionalNumber(settlementPrice);
  const strike = optionalNumber(position.option_strike);
  if (settlement !== null && strike !== null) {
    const payoff = Math.max(settlement - strike, 0);
    return {
      value: roundNumber((payoff - entry) * qty),
      finalMark: roundNumber(payoff),
      method: 'delivery_price_intrinsic_value'
    };
  }

  if (String(state).toLowerCase().includes('otm')) {
    return {
      value: roundNumber((0 - entry) * qty),
      finalMark: 0,
      method: 'estimated_zero_intrinsic_for_expired_otm'
    };
  }

  const spot = optionalNumber(finalSpot);
  if (String(state).toLowerCase().includes('itm') && spot !== null && strike !== null) {
    const payoff = Math.max(spot - strike, 0);
    return {
      value: roundNumber((payoff - entry) * qty),
      finalMark: roundNumber(payoff),
      method: 'estimated_intrinsic_value_no_settlement_record'
    };
  }

  return { value: null, finalMark: null, method: null };
}

function underlyingPnl(position, finalSpot) {
  const qty = optionalNumber(position.underlying_qty);
  const entry = optionalNumber(position.underlying_entry_price);
  const spot = optionalNumber(finalSpot);
  if (qty === null || entry === null || spot === null) return null;
  return roundNumber((spot - entry) * qty);
}

function hedgePnl(position, hedgeFinalMark) {
  const qty = optionalNumber(position.hedge_qty);
  const entry = optionalNumber(position.hedge_entry_price);
  const mark = optionalNumber(hedgeFinalMark);
  if (qty === null || entry === null || mark === null) return null;
  return roundNumber((mark - entry) * qty);
}

function initialCapital(position) {
  const qty = optionalNumber(position.underlying_qty);
  const entry = optionalNumber(position.underlying_entry_price);
  if (qty === null || entry === null) return null;
  return roundNumber(Math.abs(qty) * entry);
}

function pct(value, base) {
  const numerator = optionalNumber(value);
  const denominator = optionalNumber(base);
  if (numerator === null || denominator === null || denominator === 0) return null;
  return roundNumber((numerator / denominator) * 100);
}

function sumComplete(...values) {
  if (values.some(value => optionalNumber(value) === null)) return null;
  return roundNumber(values.reduce((sum, value) => sum + optionalNumber(value), 0));
}

function accountSignedQty(position) {
  if (!position) return null;
  const size = optionalNumber(position.size);
  if (size === null) return null;
  return String(position.side || '').toLowerCase() === 'sell' ? -Math.abs(size) : Math.abs(size);
}

function hedgeStatus(position, accountSync, monitoringRow) {
  const accountPosition = hedgePosition(accountSync, position.hedge_instrument);
  const accountQty = accountSignedQty(accountPosition);
  const qty = optionalNumber(accountQty, position.hedge_qty, monitoringRow && monitoringRow.hedge_qty);
  if (qty === null) return 'unknown';
  if (qty === 0) return 'closed';
  return 'open';
}

function hedgeBridgeRecommendation(row) {
  if (row.manual_review_required) return 'manual review required';
  if (row.hedge_status === 'open') return 'keep hedge until next T0';
  if (row.hedge_status === 'closed') return 'no action';
  return 'manual review required';
}

function maybeWarn(warnings, condition, message) {
  if (condition) warnings.push(message);
}

async function buildAsset(position, monitoringRow, accountSync, transactionLog, snapshotDate) {
  const warnings = [];
  let spotTicker = { row: null, endpoint: null };
  let hedgeTicker = { row: null, endpoint: null };
  let delivery = { row: null, endpoint: null };

  try {
    spotTicker = await fetchBybitTicker('spot', `${position.asset}USDT`);
  } catch (error) {
    warnings.push(`Bybit public spot ticker unavailable: ${error.message}`);
  }

  try {
    if (position.hedge_instrument) {
      hedgeTicker = await fetchBybitTicker('linear', position.hedge_instrument);
    }
  } catch (error) {
    warnings.push(`Bybit public hedge ticker unavailable: ${error.message}`);
  }

  try {
    if (position.option_instrument) {
      delivery = await fetchBybitDeliveryPrice(position.option_instrument);
      if (!delivery.row) warnings.push('Bybit public delivery price did not return the registered option instrument.');
    }
  } catch (error) {
    warnings.push(`Bybit public delivery price unavailable: ${error.message}`);
  }

  const deliveryRows = deliveryTransactionsFor(transactionLog.rows, position.option_instrument);
  const publicSettlement = deliveryPriceFromRow(delivery.row);
  const transactionSettlement = deliveryRows.map(deliveryPriceFromRow).find(value => value !== null) || null;
  const settlementPrice = optionalNumber(transactionSettlement, publicSettlement);
  const settlementSource = transactionSettlement !== null
    ? 'bybit_account_transaction_log'
    : publicSettlement !== null
      ? 'bybit_public_delivery_price'
      : null;
  const settlementTime = firstValue(
    deliveryRows.map(deliveryTimeFromRow).find(Boolean),
    deliveryTimeFromRow(delivery.row)
  );

  const finalSpot = optionalNumber(
    settlementPrice,
    spotTicker.row && spotTicker.row.lastPrice,
    spotTicker.row && spotTicker.row.markPrice,
    monitoringRow && monitoringRow.current_spot_price
  );
  const state = finalOptionState({
    position,
    settlementPrice,
    finalSpot,
    transactionRows: deliveryRows,
    accountSync,
    snapshotDate
  });
  warnings.push(...state.warnings);

  const option = optionPnl(position, settlementPrice, state.state, finalSpot);
  const holding = spotHolding(accountSync, position.asset);
  const initialQty = optionalNumber(position.underlying_qty);
  const finalQty = optionalNumber(holding && holding.quantity);
  const underlyingQtyDelta = initialQty === null || finalQty === null ? null : roundNumber(finalQty - initialQty);
  const underlyingDeliveredOrReduced = underlyingQtyDelta === null ? null : roundNumber(Math.max(0, -underlyingQtyDelta));
  const underlyingRemaining = finalQty;
  const underPnl = underlyingPnl(position, finalSpot);
  const capital = initialCapital(position);
  const underPnlPct = pct(underPnl, capital);

  const hedgeMark = optionalNumber(
    hedgeTicker.row && hedgeTicker.row.markPrice,
    hedgeTicker.row && hedgeTicker.row.lastPrice,
    monitoringRow && monitoringRow.hedge_mark_price
  );
  const hPnl = hedgePnl(position, hedgeMark);
  const netPnl = sumComplete(underPnl, option.value, hPnl);
  const netPnlPct = pct(netPnl, capital);
  const hedgeState = hedgeStatus(position, accountSync, monitoringRow);

  maybeWarn(warnings, !accountSync.available, 'Account sync unavailable; final underlying quantity and hedge status may be incomplete.');
  maybeWarn(warnings, finalQty === null, 'Final underlying quantity unavailable.');
  maybeWarn(warnings, underlyingQtyDelta !== null && Math.abs(underlyingQtyDelta) > 0.000001, 'Final underlying quantity differs from registered initial quantity; review assignment, transfers, or manual trades.');
  maybeWarn(warnings, option.value === null, 'Option PnL unavailable.');
  maybeWarn(warnings, underPnl === null, 'Underlying PnL unavailable.');
  maybeWarn(warnings, hPnl === null, 'Hedge PnL unavailable.');
  maybeWarn(warnings, hedgeState === 'open', 'Hedge remains open; this check does not close or reduce hedge.');

  const row = {
    asset: position.asset,
    cycle_id: position.cycle_id || null,
    opened_at: position.opened_at || null,
    generated_at: new Date().toISOString(),
    summary_date: snapshotDate,
    read_only: true,
    option_instrument: position.option_instrument || null,
    option_expiry: position.option_expiry || null,
    option_strike: optionalNumber(position.option_strike),
    option_qty: optionalNumber(position.option_qty),
    option_entry_premium: optionalNumber(position.option_entry_premium),
    premium_received: position.premium_received,
    settlement_source: settlementSource,
    settlement_price: roundNumber(settlementPrice),
    settlement_time: settlementTime,
    delivery_transaction_found: deliveryRows.length > 0,
    delivery_transaction_count: deliveryRows.length,
    final_option_state: state.state,
    final_option_state_confidence: state.confidence,
    final_option_mark: option.finalMark,
    option_pnl: option.value,
    option_pnl_method: option.method,
    initial_underlying_qty: initialQty,
    final_underlying_qty: finalQty,
    underlying_qty_delta: underlyingQtyDelta,
    underlying_delivered_or_reduced: underlyingDeliveredOrReduced,
    underlying_remaining: underlyingRemaining,
    underlying_entry_price: optionalNumber(position.underlying_entry_price),
    final_spot: roundNumber(finalSpot),
    final_spot_reference: settlementPrice !== null
      ? settlementSource
      : spotTicker.row ? 'bybit_public_spot_ticker' : (monitoringRow ? 'live_position_monitoring_fallback' : null),
    underlying_pnl_usd: underPnl,
    underlying_pnl_pct: underPnlPct,
    hedge_instrument: position.hedge_instrument || null,
    hedge_qty: optionalNumber(position.hedge_qty),
    hedge_entry_price: optionalNumber(position.hedge_entry_price),
    hedge_final_mark: roundNumber(hedgeMark),
    hedge_final_mark_reference: hedgeTicker.row ? 'bybit_public_linear_ticker' : (monitoringRow ? 'live_position_monitoring_fallback' : null),
    hedge_pnl: hPnl,
    hedge_status: hedgeState,
    net_pnl: netPnl,
    net_pnl_pct: netPnlPct,
    manual_review_required: Boolean(state.manualReview || (underlyingQtyDelta !== null && Math.abs(underlyingQtyDelta) > 0.000001) || hedgeState === 'unknown'),
    warnings,
    endpoints: {
      delivery_price: delivery.endpoint,
      spot: spotTicker.endpoint,
      hedge: hedgeTicker.endpoint
    }
  };
  row.hedge_bridge_recommendation = hedgeBridgeRecommendation(row);
  return row;
}

function consolidate(rows) {
  const netPnls = rows.map(row => optionalNumber(row.net_pnl));
  const capitals = rows.map(row => {
    const qty = optionalNumber(row.initial_underlying_qty);
    const entry = optionalNumber(row.underlying_entry_price);
    return qty === null || entry === null ? null : Math.abs(qty) * entry;
  });
  const totalNetPnl = netPnls.every(value => value !== null)
    ? roundNumber(netPnls.reduce((sum, value) => sum + value, 0))
    : null;
  const totalInitialCapital = capitals.every(value => value !== null)
    ? roundNumber(capitals.reduce((sum, value) => sum + value, 0))
    : null;
  return {
    total_net_pnl: totalNetPnl,
    total_initial_capital: totalInitialCapital,
    total_net_pnl_pct: pct(totalNetPnl, totalInitialCapital),
    manual_review_required: rows.some(row => row.manual_review_required)
  };
}

function formatMoney(value) {
  const number = optionalNumber(value);
  if (number === null) return 'N/A';
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(value) {
  const number = optionalNumber(value);
  if (number === null) return 'N/A';
  return `${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  return String(value);
}

function mdLine(label, value) {
  return `- ${label}: ${value}.`;
}

function renderMarkdown(summary) {
  const lines = [
    '# Expiry Close Check',
    '',
    mdLine('Cycle ID', summary.cycle_id),
    mdLine('Generated at', summary.generated_at),
    mdLine('Summary date', summary.summary_date),
    mdLine('Status', 'research-grade, read-only, no orders placed'),
    mdLine('Position Register mutated', 'no'),
    mdLine('Manual review required', summary.total.manual_review_required ? 'yes' : 'no'),
    '',
    '## Assets',
    ''
  ];

  for (const row of summary.assets) {
    lines.push(`### ${row.asset}`, '');
    lines.push(mdLine('Option instrument', formatValue(row.option_instrument)));
    lines.push(mdLine('Option expiry', formatValue(row.option_expiry)));
    lines.push(mdLine('Option strike', formatMoney(row.option_strike)));
    lines.push(mdLine('Option qty', formatValue(row.option_qty)));
    lines.push(mdLine('Option entry premium', `${formatMoney(row.option_entry_premium)} USD`));
    lines.push(mdLine('Premium received', `${formatMoney(row.premium_received)} USD`));
    lines.push(mdLine('Settlement source', formatValue(row.settlement_source)));
    lines.push(mdLine('Settlement price', formatMoney(row.settlement_price)));
    lines.push(mdLine('Settlement time', formatValue(row.settlement_time)));
    lines.push(mdLine('Delivery transaction found', row.delivery_transaction_found ? 'yes' : 'no'));
    lines.push(mdLine('Final option state', `${formatValue(row.final_option_state)} (${formatValue(row.final_option_state_confidence)})`));
    lines.push(mdLine('Option PnL', `${formatMoney(row.option_pnl)} USD`));
    lines.push('');
    lines.push('Underlying / UA');
    lines.push('');
    lines.push(mdLine('Initial underlying qty', formatValue(row.initial_underlying_qty)));
    lines.push(mdLine('Final underlying qty', formatValue(row.final_underlying_qty)));
    lines.push(mdLine('Underlying qty delta', formatValue(row.underlying_qty_delta)));
    lines.push(mdLine('UA delivered/reduced', formatValue(row.underlying_delivered_or_reduced)));
    lines.push(mdLine('UA remaining', formatValue(row.underlying_remaining)));
    lines.push(mdLine('Underlying entry price', formatMoney(row.underlying_entry_price)));
    lines.push(mdLine('Final spot / reference', `${formatMoney(row.final_spot)} / ${formatValue(row.final_spot_reference)}`));
    lines.push(mdLine('Underlying PnL', `${formatMoney(row.underlying_pnl_usd)} USD (${formatPct(row.underlying_pnl_pct)})`));
    lines.push('');
    lines.push('Hedge Bridge');
    lines.push('');
    lines.push(mdLine('Hedge instrument', formatValue(row.hedge_instrument)));
    lines.push(mdLine('Hedge qty', formatValue(row.hedge_qty)));
    lines.push(mdLine('Hedge entry price', formatMoney(row.hedge_entry_price)));
    lines.push(mdLine('Hedge final mark / reference', `${formatMoney(row.hedge_final_mark)} / ${formatValue(row.hedge_final_mark_reference)}`));
    lines.push(mdLine('Hedge PnL', `${formatMoney(row.hedge_pnl)} USD`));
    lines.push(mdLine('Hedge status', formatValue(row.hedge_status)));
    lines.push(mdLine('Hedge bridge recommendation', formatValue(row.hedge_bridge_recommendation)));
    lines.push('');
    lines.push('Consolidated');
    lines.push('');
    lines.push(mdLine('Net PnL', `${formatMoney(row.net_pnl)} USD (${formatPct(row.net_pnl_pct)})`));
    lines.push(mdLine('Manual review required', row.manual_review_required ? 'yes' : 'no'));
    lines.push(mdLine('Warnings', row.warnings.length ? row.warnings.join('; ') : 'N/A'));
    lines.push('');
  }

  lines.push('## TOTAL Consolidated', '');
  lines.push(mdLine('Total net PnL USD', `${formatMoney(summary.total.total_net_pnl)} USD`));
  lines.push(mdLine('Total net PnL %', formatPct(summary.total.total_net_pnl_pct)));
  lines.push(mdLine('Manual review required', summary.total.manual_review_required ? 'yes' : 'no'));
  lines.push('');
  lines.push('## Notes', '');
  lines.push('- EXPIRY_CLOSE_CHECK is a read-only operational check between expiry and the next T0.');
  lines.push('- It does not close hedges, open new options, mutate the Position Register, or implement historical cycle storage.');
  lines.push('- Hedge bridge recommendations are decision-support labels only.');
  return `${lines.join('\n')}\n`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(summary) {
  const cards = summary.assets.map(row => `
    <section>
      <h2>${escapeHtml(row.asset)}</h2>
      <div class="grid">
        <div><span>Option state</span><b>${escapeHtml(formatValue(row.final_option_state))}</b></div>
        <div><span>Settlement</span><b>${escapeHtml(formatMoney(row.settlement_price))} / ${escapeHtml(formatValue(row.settlement_source))}</b></div>
        <div><span>UA qty</span><b>${escapeHtml(formatValue(row.initial_underlying_qty))} -> ${escapeHtml(formatValue(row.final_underlying_qty))}</b></div>
        <div><span>Underlying PnL</span><b>${escapeHtml(formatMoney(row.underlying_pnl_usd))} (${escapeHtml(formatPct(row.underlying_pnl_pct))})</b></div>
        <div><span>Option PnL</span><b>${escapeHtml(formatMoney(row.option_pnl))}</b></div>
        <div><span>Hedge PnL</span><b>${escapeHtml(formatMoney(row.hedge_pnl))}</b></div>
        <div><span>Net PnL</span><b>${escapeHtml(formatMoney(row.net_pnl))} (${escapeHtml(formatPct(row.net_pnl_pct))})</b></div>
        <div><span>Hedge bridge</span><b>${escapeHtml(formatValue(row.hedge_bridge_recommendation))}</b></div>
      </div>
      <p><strong>Warnings:</strong> ${escapeHtml(row.warnings.length ? row.warnings.join('; ') : 'N/A')}</p>
    </section>
  `).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Expiry Close Check ${escapeHtml(summary.cycle_id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; color: #172033; }
    h1, h2 { margin-bottom: 8px; }
    section { border-top: 1px solid #d7dde8; padding: 18px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
    .grid div { border: 1px solid #e1e6ef; border-radius: 6px; padding: 10px; }
    span { display: block; color: #667085; font-size: 12px; margin-bottom: 4px; }
    b { font-size: 15px; }
  </style>
</head>
<body>
  <h1>Expiry Close Check</h1>
  <p><strong>Cycle ID:</strong> ${escapeHtml(summary.cycle_id)}<br>
  <strong>Generated at:</strong> ${escapeHtml(summary.generated_at)}<br>
  <strong>Status:</strong> read-only; no orders placed; Position Register not mutated.</p>
  ${cards}
  <section>
    <h2>TOTAL Consolidated</h2>
    <p><strong>Total net PnL:</strong> ${escapeHtml(formatMoney(summary.total.total_net_pnl))} USD (${escapeHtml(formatPct(summary.total.total_net_pnl_pct))})</p>
    <p><strong>Manual review required:</strong> ${summary.total.manual_review_required ? 'yes' : 'no'}</p>
  </section>
</body>
</html>
`;
}

function outputBase(cycleId) {
  const safe = String(cycleId || 'unknown_cycle').replace(/[^A-Za-z0-9_.-]+/g, '_');
  return path.join(REPORTS_DIR, `EXPIRY_CLOSE_CHECK_${safe}`);
}

async function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const snapshotDate = nyDate();
  const register = loadPositionRegister();
  const monitoringRows = loadMonitoringRows();
  const positions = register.positions.map(normalizePosition);
  const cycleIds = Array.from(new Set(positions.map(position => position.cycle_id || 'unknown_cycle')));
  const cycleId = cycleIds.length === 1 ? cycleIds[0] : cycleIds.join('__');
  const expiryDates = positions.map(position => position.option_expiry).filter(Boolean).sort();
  const minExpiry = expiryDates[0] || snapshotDate;
  const maxExpiry = expiryDates[expiryDates.length - 1] || snapshotDate;
  const accountWarnings = [];
  const accountSync = await fetchBybitAccountSync();
  const transactionLog = await fetchTransactionLog(addDays(minExpiry, -1), addDays(maxExpiry, 2), accountWarnings);
  const assets = [];

  for (const position of positions) {
    assets.push(await buildAsset(position, monitoringRows.get(position.asset), accountSync, transactionLog, snapshotDate));
  }

  const summary = {
    cycle_id: cycleId,
    generated_at: new Date().toISOString(),
    summary_date: snapshotDate,
    read_only: true,
    position_register_source: path.relative(REPO_ROOT, POSITION_REGISTER_PATH),
    position_register_mutated: false,
    account_sync: accountSync ? {
      available: Boolean(accountSync.available),
      data_source: accountSync.metadata && accountSync.metadata.data_source,
      last_sync: accountSync.metadata && accountSync.metadata.last_sync,
      environment: accountSync.metadata && accountSync.metadata.environment,
      base_url: accountSync.metadata && accountSync.metadata.base_url,
      warnings: accountSync.warnings || []
    } : null,
    transaction_log: {
      available: Boolean(transactionLog.available),
      rows_returned: transactionLog.rows.length,
      environment: transactionLog.environment || null,
      base_url: transactionLog.base_url || null,
      warnings: transactionLog.warnings || []
    },
    assets,
    total: consolidate(assets),
    warnings: [
      ...(accountWarnings || []),
      ...((accountSync && accountSync.warnings) || []),
      ...((transactionLog && transactionLog.warnings) || [])
    ],
    limitations: [
      'No orders placed.',
      'No Position Register mutation.',
      'No daily snapshots generated.',
      'No historical cycle storage implemented.',
      'Hedge bridge recommendations are read-only decision support.'
    ]
  };

  const base = outputBase(cycleId);
  const jsonPath = `${base}.json`;
  const mdPath = `${base}.md`;
  const htmlPath = `${base}.html`;
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderMarkdown(summary), 'utf8');
  fs.writeFileSync(htmlPath, renderHtml(summary), 'utf8');

  console.log('Expiry Close Check generated');
  console.log(`Cycle ID: ${cycleId}`);
  for (const row of assets) {
    console.log(`${row.asset}: ${row.final_option_state}; UA ${formatValue(row.initial_underlying_qty)} -> ${formatValue(row.final_underlying_qty)}; hedge=${row.hedge_status}; recommendation=${row.hedge_bridge_recommendation}`);
  }
  console.log(`TOTAL: ${formatMoney(summary.total.total_net_pnl)} USD (${formatPct(summary.total.total_net_pnl_pct)})`);
  console.log(`Manual review required: ${summary.total.manual_review_required ? 'yes' : 'no'}`);
  console.log(`JSON: ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`MD: ${path.relative(REPO_ROOT, mdPath)}`);
  console.log(`HTML: ${path.relative(REPO_ROOT, htmlPath)}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Error generating expiry close check: ${error.stack || error.message}`);
    process.exitCode = 1;
  });
}
