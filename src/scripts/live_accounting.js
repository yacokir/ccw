const {
  optionalNumber,
  roundNumber
} = require('./btc_deep_risk_utils');

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function sumIfComplete(...values) {
  if (values.some(value => optionalNumber(value) === null)) return null;
  return roundNumber(values.reduce((sum, value) => sum + optionalNumber(value), 0));
}

function pct(value, base) {
  const numerator = optionalNumber(value);
  const denominator = optionalNumber(base);
  if (numerator === null || denominator === null || denominator === 0) return null;
  return roundNumber((numerator / denominator) * 100);
}

function capitalBase(qty, price) {
  const q = optionalNumber(qty);
  const p = optionalNumber(price);
  if (q === null || p === null) return null;
  return roundNumber(Math.abs(q) * p);
}

function optionMtmPnl(qty, entryPremium, markPrice) {
  const q = optionalNumber(qty);
  const entry = optionalNumber(entryPremium);
  const mark = optionalNumber(markPrice);
  if (q === null || entry === null || mark === null) return null;
  return roundNumber((mark - entry) * q);
}

function signedPositionPnl(qty, entryPrice, markPrice) {
  const q = optionalNumber(qty);
  if (q === 0) return 0;
  const entry = optionalNumber(entryPrice);
  const mark = optionalNumber(markPrice);
  if (q === null || entry === null || mark === null) return null;
  return roundNumber((mark - entry) * q);
}

function buildAccountingViews({ position, currentSpotPrice, optionMarkPrice, hedgeMarkPrice }) {
  const warnings = [];
  const cycle = position && position.cycle_accounting && typeof position.cycle_accounting === 'object'
    ? position.cycle_accounting
    : {};

  const underlyingQty = optionalNumber(position && position.underlying_qty);
  const portfolioEntryPrice = optionalNumber(
    position && position.underlying_entry_price,
    position && position.underlying_cost_basis && position.underlying_cost_basis.average_entry_price
  );
  const cycleReferencePrice = optionalNumber(
    cycle.underlying_reference_price,
    position && position.cycle_underlying_reference_price,
    portfolioEntryPrice
  );
  const cycleReferenceSource = firstValue(
    cycle.underlying_reference_source,
    position && position.cycle_underlying_reference_source,
    cycle.underlying_reference_price === undefined ? 'legacy_underlying_entry_price_fallback' : null
  );
  const cycleReferenceTimestamp = firstValue(
    cycle.underlying_reference_timestamp,
    position && position.cycle_underlying_reference_timestamp,
    position && position.opened_at,
    position && position.option_entry_ts,
    position && position.short_call_entry_timestamp
  );
  const cycleOpenedAt = firstValue(
    cycle.cycle_opened_at,
    position && position.opened_at,
    position && position.option_entry_ts,
    position && position.short_call_entry_timestamp
  );

  if (!cycle || optionalNumber(cycle.underlying_reference_price) === null) {
    warnings.push('Current cycle underlying reference price missing; using legacy underlying entry price fallback.');
  }

  const optionQty = optionalNumber(position && position.short_call_qty, position && position.option_qty);
  const optionEntryPremium = optionalNumber(position && position.short_call_entry_premium, position && position.option_entry_premium);
  const hedgeQty = optionalNumber(position && position.hedge_qty);
  const hedgeEntryPrice = optionalNumber(position && position.hedge_entry_price);
  const spot = optionalNumber(currentSpotPrice);

  const cycleUnderlyingPnl = signedPositionPnl(underlyingQty, cycleReferencePrice, spot);
  const portfolioUnderlyingPnl = signedPositionPnl(underlyingQty, portfolioEntryPrice, spot);
  const optionPnl = optionMtmPnl(optionQty, optionEntryPremium, optionMarkPrice);
  const hedgePnl = signedPositionPnl(hedgeQty, hedgeEntryPrice, hedgeMarkPrice);
  const cycleCapitalBase = optionalNumber(cycle.capital_base) ?? capitalBase(underlyingQty, cycleReferencePrice);
  const portfolioCapitalBase = capitalBase(underlyingQty, portfolioEntryPrice);
  const netCyclePnl = sumIfComplete(cycleUnderlyingPnl, optionPnl, hedgePnl);
  const portfolioNetPnl = sumIfComplete(portfolioUnderlyingPnl, optionPnl, hedgePnl);

  return {
    current_cycle_accounting: {
      scope: 'CURRENT_CYCLE',
      cycle_id: position && position.cycle_id || null,
      cycle_opened_at: cycleOpenedAt || null,
      underlying_reference_price: roundNumber(cycleReferencePrice),
      underlying_reference_timestamp: cycleReferenceTimestamp || null,
      underlying_reference_source: cycleReferenceSource || null,
      underlying_qty: roundNumber(underlyingQty),
      underlying_pnl_since_cycle_open: cycleUnderlyingPnl,
      option_pnl_current_cycle: optionPnl,
      hedge_pnl_current_cycle: hedgePnl,
      net_cycle_pnl: netCyclePnl,
      net_cycle_pnl_pct: pct(netCyclePnl, cycleCapitalBase),
      capital_base: roundNumber(cycleCapitalBase)
    },
    portfolio_lifetime_accounting: {
      scope: 'PORTFOLIO_LIFETIME',
      underlying_entry_price: roundNumber(portfolioEntryPrice),
      underlying_entry_timestamp: firstValue(
        position && position.underlying_entry_timestamp,
        position && position.underlying_entry_ts,
        position && position.underlying_cost_basis && position.underlying_cost_basis.first_fill_timestamp
      ),
      underlying_qty: roundNumber(underlyingQty),
      underlying_pnl_since_original_spot_purchase: portfolioUnderlyingPnl,
      current_option_pnl: optionPnl,
      current_hedge_pnl: hedgePnl,
      portfolio_net_pnl: portfolioNetPnl,
      portfolio_net_pnl_pct: pct(portfolioNetPnl, portfolioCapitalBase),
      capital_base: roundNumber(portfolioCapitalBase)
    },
    legacy_accounting: {
      underlying_unrealized_pnl: portfolioUnderlyingPnl,
      option_unrealized_pnl_approx: optionPnl,
      hedge_unrealized_pnl_approx: hedgePnl,
      net_unrealized_pnl_approx: portfolioNetPnl,
      note: 'Legacy flat fields mirror Portfolio / Lifetime accounting to avoid hybrid Net PnL.'
    },
    accounting_warnings: warnings
  };
}

module.exports = {
  buildAccountingViews,
  sumIfComplete
};
