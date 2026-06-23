const { optionalNumber, roundNumber } = require('./btc_deep_risk_utils');
const {
  BybitReadOnlyAccountClient,
  bybitConfigFromEnv,
  hasCredentials
} = require('./bybit_readonly_account_client');

const DATA_SOURCE = 'BYBIT_ACCOUNT_API';
const ACCOUNT_TYPE = 'UNIFIED';
const SYNC_CATEGORIES = ['spot', 'linear', 'option'];

function nyTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const mapped = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day} ${mapped.hour}:${mapped.minute}:${mapped.second} America/New_York`;
}

function compactError(error) {
  return error && error.message ? error.message : String(error);
}

function isNonZero(value) {
  const number = optionalNumber(value);
  return number !== null && number !== 0;
}

function bySymbol(rows) {
  return new Map((rows || [])
    .filter(row => row && row.symbol)
    .map(row => [row.symbol, row]));
}

function normalizeWallet(payload) {
  const accounts = payload && payload.result && Array.isArray(payload.result.list)
    ? payload.result.list
    : [];
  return accounts.flatMap(account => (account.coin || []).map(coin => ({
    account_type: account.accountType || ACCOUNT_TYPE,
    coin: coin.coin,
    wallet_balance: roundNumber(coin.walletBalance),
    equity: roundNumber(coin.equity)
  })));
}

function normalizeSpotHoldings(walletRows) {
  return (walletRows || [])
    .filter(row => row.coin && isNonZero(row.wallet_balance))
    .map(row => ({
      asset: row.coin,
      quantity: row.wallet_balance,
      equity: row.equity
    }));
}

function normalizePosition(row, category) {
  return {
    category,
    symbol: row.symbol || null,
    size: roundNumber(row.size),
    side: row.side || null,
    avg_entry_price: roundNumber(row.avgPrice),
    mark_price: roundNumber(row.markPrice),
    unrealized_pnl: roundNumber(row.unrealisedPnl),
    strike: row.symbol ? optionStrike(row.symbol) : null,
    expiry: row.symbol ? optionExpiry(row.symbol) : null
  };
}

function normalizeExecution(row, category) {
  return {
    category,
    symbol: row.symbol || null,
    fill_price: roundNumber(row.execPrice),
    quantity: roundNumber(row.execQty),
    fee: roundNumber(row.execFee),
    timestamp: row.execTime ? new Date(Number(row.execTime)).toISOString() : null,
    side: row.side || null,
    order_id: row.orderId || null,
    exec_id: row.execId || null
  };
}

function normalizeOrder(row, category) {
  return {
    category,
    symbol: row.symbol || null,
    status: row.orderStatus || null,
    created_at: row.createdTime ? new Date(Number(row.createdTime)).toISOString() : null,
    updated_at: row.updatedTime ? new Date(Number(row.updatedTime)).toISOString() : null,
    average_execution_price: roundNumber(row.avgPrice),
    quantity: roundNumber(row.qty),
    side: row.side || null,
    order_id: row.orderId || null
  };
}

function optionStrike(symbol) {
  const parts = String(symbol || '').split('-');
  return parts.length >= 3 ? optionalNumber(parts[2]) : null;
}

function optionExpiry(symbol) {
  const parts = String(symbol || '').split('-');
  if (parts.length < 2) return null;
  const raw = parts[1];
  const match = raw.match(/^(\d{2})([A-Z]{3})(\d{2})$/);
  if (!match) return raw;
  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
  };
  return `20${match[3]}-${months[match[2]] || '01'}-${match[1]}`;
}

async function captureStep(warnings, label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    warnings.push(`${label} unavailable: ${compactError(error)}`);
    return fallback;
  }
}

async function fetchBybitAccountSync(env = process.env) {
  const config = bybitConfigFromEnv(env);
  const warnings = [];
  const now = new Date();
  const metadata = {
    data_source: DATA_SOURCE,
    generated_at: now.toISOString(),
    last_sync: nyTimestamp(now),
    environment: config.environment,
    base_url: config.baseUrl,
    testnet: config.testnet,
    read_only: true
  };

  if (!hasCredentials(env)) {
    return {
      available: false,
      metadata,
      warnings: ['Bybit account sync skipped: BYBIT_API_KEY or BYBIT_API_SECRET is not configured.'],
      wallet_balances: [],
      spot_holdings: [],
      perpetual_positions: [],
      option_positions: [],
      executions: [],
      orders: []
    };
  }

  const client = new BybitReadOnlyAccountClient(config);
  const walletPayload = await captureStep(warnings, 'Wallet balances', () => client.walletBalance(ACCOUNT_TYPE), null);
  const walletBalances = normalizeWallet(walletPayload);

  const linearPositionsPayload = await captureStep(warnings, 'Perpetual positions', () => client.positions('linear', { settleCoin: 'USDT' }), null);
  const optionPositionsPayload = await captureStep(warnings, 'Option positions', () => client.positions('option', { settleCoin: 'USDT' }), null);
  const perpetualPositions = ((linearPositionsPayload && linearPositionsPayload.result && linearPositionsPayload.result.list) || [])
    .filter(row => isNonZero(row.size))
    .map(row => normalizePosition(row, 'linear'));
  const optionPositions = ((optionPositionsPayload && optionPositionsPayload.result && optionPositionsPayload.result.list) || [])
    .filter(row => isNonZero(row.size))
    .map(row => normalizePosition(row, 'option'));

  const executions = [];
  const orders = [];
  for (const category of SYNC_CATEGORIES) {
    const executionPayload = await captureStep(warnings, `${category} executions`, () => client.executions(category), null);
    const orderPayload = await captureStep(warnings, `${category} order history`, () => client.orderHistory(category), null);
    executions.push(...(((executionPayload && executionPayload.result && executionPayload.result.list) || [])
      .map(row => normalizeExecution(row, category))));
    orders.push(...(((orderPayload && orderPayload.result && orderPayload.result.list) || [])
      .map(row => normalizeOrder(row, category))));
  }

  return {
    available: Boolean(warnings.length === 0 || walletBalances.length || perpetualPositions.length || optionPositions.length || executions.length || orders.length),
    metadata,
    warnings,
    wallet_balances: walletBalances,
    spot_holdings: normalizeSpotHoldings(walletBalances),
    perpetual_positions: perpetualPositions,
    option_positions: optionPositions,
    executions,
    orders
  };
}

function executionFeesBySymbol(executions) {
  const fees = new Map();
  for (const execution of executions || []) {
    const fee = optionalNumber(execution.fee);
    if (!execution.symbol || fee === null) continue;
    fees.set(execution.symbol, roundNumber((fees.get(execution.symbol) || 0) + fee));
  }
  return fees;
}

function reconstructSpotCostBasis(asset, executions) {
  const acceptedSymbols = new Set([`${asset}USDT`, `${asset}USDC`]);
  const fills = (executions || [])
    .filter(execution => execution && execution.category === 'spot')
    .filter(execution => acceptedSymbols.has(execution.symbol))
    .filter(execution => String(execution.side || '').toLowerCase() === 'buy')
    .map(execution => ({
      symbol: execution.symbol,
      price: optionalNumber(execution.fill_price),
      quantity: optionalNumber(execution.quantity),
      timestamp: execution.timestamp || null
    }))
    .filter(fill => fill.price !== null && fill.quantity !== null && fill.quantity > 0);

  if (!fills.length) return null;

  const totalQuantity = fills.reduce((sum, fill) => sum + fill.quantity, 0);
  const totalCost = fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0);
  if (totalQuantity <= 0 || totalCost <= 0) return null;

  const timestamps = fills.map(fill => fill.timestamp).filter(Boolean).sort();
  return {
    method: 'spot_execution_weighted_average_buy_cost',
    source: 'BYBIT_ACCOUNT_API_EXECUTIONS',
    symbols: [...new Set(fills.map(fill => fill.symbol).filter(Boolean))],
    fill_count: fills.length,
    acquired_qty: roundNumber(totalQuantity),
    total_cost: roundNumber(totalCost),
    average_entry_price: roundNumber(totalCost / totalQuantity),
    first_fill_timestamp: timestamps[0] || null,
    last_fill_timestamp: timestamps[timestamps.length - 1] || null
  };
}

function hedgeCostBasis(hedge) {
  const qty = hedge ? optionalNumber(hedge.size) : null;
  const entry = hedge ? optionalNumber(hedge.avg_entry_price) : null;
  if (qty === null || entry === null) return null;
  return {
    method: 'bybit_position_average_entry',
    source: 'BYBIT_ACCOUNT_API_POSITIONS',
    symbol: hedge.symbol || null,
    quantity: signedQty(hedge),
    average_entry_price: entry,
    notional_cost: roundNumber(Math.abs(qty) * entry)
  };
}

function mergeAccountSyncIntoRegister(register, accountSync) {
  if (!accountSync || !accountSync.available) return register;

  const spotByAsset = new Map((accountSync.spot_holdings || []).map(row => [row.asset, row]));
  const perps = bySymbol(accountSync.perpetual_positions);
  const options = bySymbol(accountSync.option_positions);
  const fees = executionFeesBySymbol(accountSync.executions);
  const positions = Array.isArray(register.positions) ? register.positions : [];

  return {
    ...register,
    account_sync: {
      ...accountSync.metadata,
      warnings: accountSync.warnings
    },
    positions: positions.map(position => {
      const asset = position.asset;
      const spot = spotByAsset.get(asset);
      const hedge = position.hedge_instrument ? perps.get(position.hedge_instrument) : null;
      const optionSymbol = position.short_call_symbol || position.option_instrument;
      const option = optionSymbol ? options.get(optionSymbol) : null;
      const underlyingCostBasis = reconstructSpotCostBasis(asset, accountSync.executions);
      const hedgeBasis = hedgeCostBasis(hedge);
      const symbolFees = [
        optionSymbol ? fees.get(optionSymbol) : null,
        position.hedge_instrument ? fees.get(position.hedge_instrument) : null
      ].filter(value => optionalNumber(value) !== null);

      return {
        ...position,
        underlying_qty: spot && optionalNumber(spot.quantity) !== null ? spot.quantity : position.underlying_qty,
        underlying_entry_price: underlyingCostBasis ? underlyingCostBasis.average_entry_price : position.underlying_entry_price,
        underlying_entry_ts: underlyingCostBasis ? underlyingCostBasis.first_fill_timestamp : position.underlying_entry_ts,
        underlying_entry_timestamp: underlyingCostBasis ? underlyingCostBasis.first_fill_timestamp : position.underlying_entry_timestamp,
        underlying_cost_basis: underlyingCostBasis || position.underlying_cost_basis || null,
        short_call_qty: option && optionalNumber(option.size) !== null ? signedQty(option) : position.short_call_qty,
        option_qty: option && optionalNumber(option.size) !== null ? signedQty(option) : position.option_qty,
        short_call_entry_premium: option && optionalNumber(option.avg_entry_price) !== null ? option.avg_entry_price : position.short_call_entry_premium,
        option_entry_premium: option && optionalNumber(option.avg_entry_price) !== null ? option.avg_entry_price : position.option_entry_premium,
        hedge_qty: hedge && optionalNumber(hedge.size) !== null ? signedQty(hedge) : position.hedge_qty,
        hedge_entry_price: hedge && optionalNumber(hedge.avg_entry_price) !== null ? hedge.avg_entry_price : position.hedge_entry_price,
        hedge_cost_basis: hedgeBasis || position.hedge_cost_basis || null,
        accumulated_fees: symbolFees.length ? roundNumber(symbolFees.reduce((sum, value) => sum + optionalNumber(value), 0)) : position.accumulated_fees,
        account_sync: {
          data_source: DATA_SOURCE,
          last_sync: accountSync.metadata.last_sync,
          matched_spot: Boolean(spot),
          matched_option_position: Boolean(option),
          matched_perpetual_position: Boolean(hedge),
          reconstructed_underlying_cost_basis: Boolean(underlyingCostBasis)
        }
      };
    })
  };
}

function signedQty(position) {
  const size = optionalNumber(position.size);
  if (size === null) return null;
  return String(position.side || '').toLowerCase() === 'sell' ? -Math.abs(size) : Math.abs(size);
}

module.exports = {
  DATA_SOURCE,
  fetchBybitAccountSync,
  mergeAccountSyncIntoRegister,
  reconstructSpotCostBasis
};
