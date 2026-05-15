const { getOHLCData, getDeliveryPriceByDate } = require('../data/deribit');
const { selectStrike } = require('../data/discovery');
const { getCandleAt, getCandleAtOrAfter } = require('../data/ohlc');
const { computeGarmanKlassVolatility } = require('../models/volatility/garman_klass');
const { black76CallPrice } = require('../models/options/black76');

const OPTION_SETTLEMENT_PRICE_SOURCE_MAP = {
  DERIBIT_BTC_USD_DELIVERY_PRICE: {
    type: 'deribit_delivery_price',
    indexName: 'btc_usd'
  },
  // Backward-compatible alias for old run configs. Settlement now resolves
  // through official Deribit delivery prices, not index chart point matching.
  DERIBIT_BTC_USD_INDEX_OHLC_PROXY: {
    type: 'deribit_delivery_price',
    indexName: 'btc_usd',
    deprecatedAlias: true
  }
};

const CURRENT_EXIT_HOUR_UTC = 8;
const CURRENT_EXIT_MINUTE_UTC = 0;
const THEORETICAL_VOL_SOURCE = 'BTC-PERPETUAL';
const THEORETICAL_VOL_LOOKBACK_DAYS = 14;
const THEORETICAL_VOL_PERIODS_PER_YEAR = 24 * 365;
const MILLISECONDS_PER_YEAR_365D = 365 * 24 * 60 * 60 * 1000;
const THEORETICAL_RISK_FREE_RATE = 0;

// Generate expiry code from date (e.g., "10OCT25" for 2025-10-10)
function getExpiryCode(date) {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getUTCMonth()];
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${day}${month}${year}`;
}

// Generate candidate strikes: from target - strikeRange to target + strikeRange, step strikeStep, rounded
function generateCandidateStrikes(target, strikeRange, strikeStep) {
  const strikes = [];
  const min = Math.ceil((target - strikeRange) / strikeStep) * strikeStep;
  const max = Math.floor((target + strikeRange) / strikeStep) * strikeStep;
  for (let strike = min; strike <= max; strike += strikeStep) {
    strikes.push(strike);
  }
  return strikes;
}

// Generate Friday-based weekly cycles at a configurable UTC entry time.
// endDate is a completed-cycle boundary: include a cycle only when its
// computed exit timestamp is <= endDate, not merely when entry is <= endDate.
function generateFridayCycles(startDate, endDate, entryHourUtc, entryMinuteUtc) {
  const cycles = [];
  let current = new Date(startDate);
  
  // Find first Friday
  while (current.getUTCDay() !== 5) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  while (current <= endDate) {
    const entry = new Date(current);
    entry.setUTCHours(entryHourUtc, entryMinuteUtc, 0, 0);
    const exit = new Date(current);
    exit.setUTCDate(exit.getUTCDate() + 7);
    exit.setUTCHours(CURRENT_EXIT_HOUR_UTC, CURRENT_EXIT_MINUTE_UTC, 0, 0);

    // Include only fully completed cycles inside the requested run window.
    if (exit > endDate) {
      break;
    }
    
    cycles.push({ entry: entry.getTime(), exit: exit.getTime() });
    current.setUTCDate(current.getUTCDate() + 7);
  }
  
  return cycles;
}

function generateCycles(config) {
  // Tenor dispatch is intentionally minimal: weekly remains the default
  // compatibility baseline and continues to use the existing Friday logic.
  const tenor = config.tenor || 'weekly';

  if (tenor === 'weekly') {
    return generateFridayCycles(config.startDate, config.endDate, config.entryHourUtc, config.entryMinuteUtc);
  }

  throw new Error(`Unsupported tenor: ${tenor}`);
}

function parseEndDateForCycleBoundary(endDate, exitHourUtc, exitMinuteUtc) {
  if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const hour = String(exitHourUtc).padStart(2, '0');
    const minute = String(exitMinuteUtc).padStart(2, '0');
    return new Date(`${endDate}T${hour}:${minute}:00Z`);
  }

  return new Date(endDate);
}

function chartDataToCandles(chartData) {
  const ticks = chartData.ticks || [];
  return ticks.map((timestamp, index) => ({
    timestamp,
    open: chartData.open[index],
    high: chartData.high[index],
    low: chartData.low[index],
    close: chartData.close[index]
  }));
}

function calculateAnnualizedVolatilityOfWeeklyReturns(trades) {
  const returns = trades
    .map(trade => Number(trade.return_pct))
    .filter(value => Number.isFinite(value));

  if (returns.length < 2) {
    return null;
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(52);
}

function buildSummaryMetrics(trades, capitalUsd) {
  const initialCapital = trades.length > 0 ? trades[0].capital_before : 0;
  const initialBtcPrice = trades.length > 0 ? trades[0].S_entry : 0;
  const finalBtcPrice = trades.length > 0 ? trades[trades.length - 1].S_exit : 0;
  const finalCapital = capitalUsd;
  const runReturnPct = initialCapital > 0 ? ((finalCapital / initialCapital) - 1) * 100 : 0;
  const btcReturnPct = initialBtcPrice > 0 ? ((finalBtcPrice / initialBtcPrice) - 1) * 100 : 0;
  const annualizedVolatilityOfWeeklyReturns = calculateAnnualizedVolatilityOfWeeklyReturns(trades);

  return {
    initialCapital,
    finalCapital,
    totalPnLCall: trades.reduce((sum, trade) => sum + trade.pnl_call, 0),
    totalPnLUnderlying: trades.reduce((sum, trade) => sum + trade.pnl_underlying, 0),
    totalPnL: trades.reduce((sum, trade) => sum + trade.pnl_total, 0),
    callWeeks: trades.filter(trade => trade.has_call).length,
    totalWeeks: trades.length,
    observedOptionWeeks: trades.filter(trade => trade.option_entry_price_source === 'observed').length,
    theoreticalFallbackWeeks: trades.filter(trade => trade.option_entry_price_source === 'theoretical').length,
    syntheticOptionWeeks: trades.filter(trade => trade.option_entry_is_synthetic).length,
    missingObservedInstrumentWeeks: trades.filter(trade => trade.option_entry_fallback_reason === 'missing_observed_option_instrument').length,
    missingObservedCandleWeeks: trades.filter(trade => trade.option_entry_fallback_reason === 'missing_observed_option_candle').length,
    invalidObservedOpenWeeks: trades.filter(trade => trade.option_entry_fallback_reason === 'invalid_observed_option_open').length,
    settlementFallbackWeeks: trades.filter(trade => trade.option_settlement_price_fallback_occurred).length,
    initialBtcPrice,
    finalBtcPrice,
    runReturnPct,
    btcReturnPct,
    annualizedVolatilityOfWeeklyReturns,
    annualizedVolatilityOfWeeklyReturnsPct: annualizedVolatilityOfWeeklyReturns !== null
      ? annualizedVolatilityOfWeeklyReturns * 100
      : null
  };
}

async function getTheoreticalCallEntryPrice({ entryTime, exitTime, S_entry, strike }) {
  const lookbackMs = THEORETICAL_VOL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const volStartTime = entryTime - lookbackMs;
  const volEndTime = entryTime - 1;
  const timeToExpiryYears = (exitTime - entryTime) / MILLISECONDS_PER_YEAR_365D;

  try {
    const volData = await getOHLCData(THEORETICAL_VOL_SOURCE, volStartTime, volEndTime, 60);
    const volCandles = chartDataToCandles(volData);
    const volResult = computeGarmanKlassVolatility(volCandles, {
      periodsPerYear: THEORETICAL_VOL_PERIODS_PER_YEAR
    });
    const optionVol = volResult.annualizedVolatility;

    if (!optionVol || optionVol <= 0) {
      return {
        ok: false,
        reason: 'invalid_garman_klass_volatility',
        volatilityDiagnostics: volResult.diagnostics,
        pricingDiagnostics: null
      };
    }

    const pricingResult = black76CallPrice({
      forwardPrice: S_entry,
      strike,
      timeToExpiryYears,
      volatility: optionVol,
      riskFreeRate: THEORETICAL_RISK_FREE_RATE
    });

    if (!pricingResult.diagnostics.valid || !pricingResult.price || pricingResult.price <= 0) {
      return {
        ok: false,
        reason: 'invalid_black76_price',
        volatilityDiagnostics: volResult.diagnostics,
        pricingDiagnostics: pricingResult.diagnostics
      };
    }

    return {
      ok: true,
      theoreticalPremiumUsd: pricingResult.price,
      theoreticalPremiumBtc: pricingResult.price / S_entry,
      optionVol,
      volatilityDiagnostics: volResult.diagnostics,
      pricingDiagnostics: pricingResult.diagnostics,
      timeToExpiryYears,
      volStartTime,
      volEndTime
    };
  } catch (error) {
    return {
      ok: false,
      reason: error.message,
      volatilityDiagnostics: null,
      pricingDiagnostics: null
    };
  }
}

async function getOptionSettlementPrice(source, exitTime, window, fallbackPrice) {
  const mappedSource = OPTION_SETTLEMENT_PRICE_SOURCE_MAP[source] || {
    type: 'instrument_ohlc',
    instrumentName: source
  };
  let fallbackReason = null;
  let caughtErrorMessage = null;
  let deliveryLookup = null;
  let instrumentData = null;

  try {
    if (mappedSource.type === 'deribit_delivery_price') {
      deliveryLookup = await getDeliveryPriceByDate(mappedSource.indexName, exitTime);
      const deliveryPrice = deliveryLookup.found ? Number(deliveryLookup.deliveryPrice) : null;

      if (Number.isFinite(deliveryPrice) && deliveryPrice > 0) {
        return {
          price: deliveryPrice,
          source,
          resolvedSource: mappedSource.indexName,
          resolvedSourceType: 'deribit_delivery_price',
          fallbackOccurred: false,
          fallbackReason: null,
          deliveryDate: deliveryLookup.date,
          isProxy: false,
          note: mappedSource.deprecatedAlias
            ? 'Deprecated index-chart source alias resolved to official Deribit delivery price'
            : 'Official Deribit delivery settlement price'
        };
      }

      fallbackReason = deliveryLookup.found
        ? 'settlement_invalid_delivery_price'
        : 'settlement_delivery_price_not_found';
    } else {
      instrumentData = await getOHLCData(mappedSource.instrumentName, exitTime, exitTime + window, 60);

      if (!instrumentData || !Array.isArray(instrumentData.ticks) || instrumentData.ticks.length === 0) {
        fallbackReason = 'settlement_no_points';
      }

      const candle = getCandleAt(instrumentData, exitTime) || getCandleAtOrAfter(instrumentData, exitTime);
      const candleOpen = candle ? Number(candle.open) : null;

      if (Number.isFinite(candleOpen) && candleOpen > 0) {
        return {
          price: candleOpen,
          source,
          resolvedSource: mappedSource.instrumentName,
          resolvedSourceType: 'instrument_ohlc',
          fallbackOccurred: false,
          fallbackReason: null,
          deliveryDate: null,
          isProxy: true,
          note: 'Instrument OHLC settlement source'
        };
      }

      if (!fallbackReason) {
        fallbackReason = candle ? 'settlement_invalid_price' : 'settlement_no_candle';
      }
    }
  } catch (error) {
    fallbackReason = 'settlement_fetch_error';
    caughtErrorMessage = error.message;
  }

  const ticks = instrumentData && Array.isArray(instrumentData.ticks) ? instrumentData.ticks : [];
  console.log('Settlement fallback debug:', {
    reason: fallbackReason,
    source,
    mappedSource,
    exitTime: new Date(exitTime).toISOString(),
    deliveryDate: deliveryLookup ? deliveryLookup.date : new Date(exitTime).toISOString().slice(0, 10),
    deliveryFound: deliveryLookup ? deliveryLookup.found : null,
    deliveryPrice: deliveryLookup ? deliveryLookup.deliveryPrice : null,
    instrumentPointCount: ticks.length,
    instrumentFirstTimestamp: ticks.length > 0 ? new Date(ticks[0]).toISOString() : null,
    instrumentLastTimestamp: ticks.length > 0 ? new Date(ticks[ticks.length - 1]).toISOString() : null,
    caughtErrorMessage,
  });

  return {
    price: fallbackPrice,
    source,
    resolvedSource: 'BTC-PERPETUAL',
    resolvedSourceType: 'instrument_ohlc_fallback',
    fallbackOccurred: true,
    fallbackReason,
    deliveryDate: deliveryLookup ? deliveryLookup.date : new Date(exitTime).toISOString().slice(0, 10),
    isProxy: true,
    note: 'Official delivery settlement unavailable; using BTC exposure exit price as explicit compatibility fallback'
  };
}

function emitProgress(onProgress, progress) {
  if (typeof onProgress !== 'function') return;

  try {
    onProgress(progress);
  } catch (error) {
    // Progress reporting is observational only; it must not affect results.
  }
}

async function runStrategy(config = {}, options = {}) {
  const { onProgress } = options;
  const underlyingPriceSource = config.underlyingPriceSource || config.underlying || 'BTC-PERPETUAL';
  const optionSettlementPriceSource = config.optionSettlementPriceSource || 'DERIBIT_BTC_USD_DELIVERY_PRICE';
  const {
    startDate = '2025-10-03',
    endDate = '2025-12-26',
    xOtm = 0.05,
    underlying = underlyingPriceSource,
    strikeStep = 1000,
    strikeRange = 3000,
    fallbackMode = 'long_btc',
    sizingMode = 'dynamic',
    maxEntryDelayMinutes = 60,
    tenor = 'weekly',
    entryHourUtc = 8,
    entryMinuteUtc = 0
  } = config;

  const normalizedConfig = {
    startDate,
    endDate,
    xOtm,
    underlying,
    underlyingPriceSource,
    optionSettlementPriceSource,
    strikeStep,
    strikeRange,
    fallbackMode,
    sizingMode,
    maxEntryDelayMinutes,
    tenor,
    entryHourUtc,
    entryMinuteUtc
  };

  try {
    const startDateObj = new Date(startDate);
    // Date-only endDate values mean "through the cycle exit on that date".
    // Full timestamps remain exact, so 2025-12-26T00:00:00Z stays midnight.
    const endDateObj = parseEndDateForCycleBoundary(endDate, CURRENT_EXIT_HOUR_UTC, CURRENT_EXIT_MINUTE_UTC);
    const cycles = generateCycles({
      startDate: startDateObj,
      endDate: endDateObj,
      entryHourUtc,
      entryMinuteUtc,
      tenor
    });
    const trades = [];
    const equityCurve = [];
    let capitalUsd = null;

    console.log(`Running ${cycles.length} ${tenor} cycles from ${startDateObj.toISOString()} to ${endDateObj.toISOString()}\n`);

    for (let i = 0; i < cycles.length; i++) {
      const cycle = cycles[i];
      const entryTime = cycle.entry;
      const exitTime = cycle.exit;

      emitProgress(onProgress, {
        currentCycle: i + 1,
        totalCycles: cycles.length,
        entryTime,
        exitTime
      });

      const entryDate = new Date(entryTime);
      const exitDate = new Date(exitTime);
      const expiry = getExpiryCode(exitDate);

      console.log(`\n=== Cycle ${i + 1}: Entry ${entryDate.toISOString()} → Exit ${exitDate.toISOString()} (${expiry}) ===`);

      try {
        const window = 3600000; // 1 hour

        // Fetch BTC exposure candle at entry timestamp for S_entry
        const spotEntryData = await getOHLCData(underlyingPriceSource, entryTime, entryTime + window, 60);
        const spotEntryCandle = getCandleAt(spotEntryData, entryTime);
        const S_entry = spotEntryCandle ? spotEntryCandle.open : null;

        if (!S_entry) {
          console.log(`Entry candle not found for ${underlyingPriceSource}`);
          continue;
        }

        // Fetch BTC exposure candle at exit timestamp for S_exit
        const spotExitData = await getOHLCData(underlyingPriceSource, exitTime, exitTime + window, 60);
        const spotExitCandle = getCandleAt(spotExitData, exitTime);
        const S_exit = spotExitCandle ? spotExitCandle.open : null;

        if (!S_exit) {
          console.log(`Exit candle not found for ${underlyingPriceSource}`);
          continue;
        }

        const settlementPrice = await getOptionSettlementPrice(optionSettlementPriceSource, exitTime, window, S_exit);
        const S_settlement = settlementPrice.price;

        console.log(`S_entry: ${S_entry}, S_exit: ${S_exit}, S_settlement: ${S_settlement}`);

        // Determine BTC position: 1 for first cycle, else based on current capital
        let btcPosition;
        if (capitalUsd === null) {
          btcPosition = 1;
        } else {
          btcPosition = capitalUsd / S_entry;
        }
        console.log(`BTC position: ${btcPosition}`);

        // Calculate underlying PnL
        const pnlUnderlying = btcPosition * (S_exit - S_entry);

        // Compute target and generate candidate strikes
        const target = S_entry * (1 + xOtm);
        console.log(`Target: ${target}`);

        const strikes = generateCandidateStrikes(target, strikeRange, strikeStep);
        console.log(`Checking ${strikes.length} strikes from ${strikes[0]} to ${strikes[strikes.length - 1]}...`);

        // Build validInstruments
        const validInstruments = [];

        for (const strike of strikes) {
          const instrumentName = `BTC-${expiry}-${strike}-C`;

          try {
            const data = await getOHLCData(instrumentName, entryTime, entryTime + window, 60);

            if (data.status === 'ok' && data.ticks.length > 0) {
              validInstruments.push({
                instrument_name: instrumentName,
                strike: strike,
              });
            }
          } catch (error) {
            // Skip instruments that don't exist
          }
        }

        let hasCall = false;
        let pnlCall = 0;
        let selectedInstrument = null;
        let selectedStrike = null;
        let C_entry = null;
        let C_entry_usd = null;
        let C_entry_btc = null;
        let payoff = null;
        let optionEntryTimestamp = null;
        let optionEntryDelayMinutes = null;
        let optionEntryPriceSource = null;
        let optionEntryModel = null;
        let optionEntryVolModel = null;
        let optionEntryVol = null;
        let optionEntryFallbackReason = null;
        let optionEntryIsSynthetic = false;
        let optionEntryDiagnostics = null;

        if (validInstruments.length > 0) {
          console.log(`Found ${validInstruments.length} valid instruments`);

          // Select the instrument with strike closest to target
          selectedInstrument = selectStrike(validInstruments, target);
          selectedStrike = selectedInstrument.strike;

          console.log(`Selected: ${selectedInstrument.instrument_name}`);

          // Fetch option candle with delayed entry window
          const delayWindowMs = maxEntryDelayMinutes * 60 * 1000;
          const ohlcData = await getOHLCData(selectedInstrument.instrument_name, entryTime, entryTime + delayWindowMs, 60);
          
          // Try exact candle at entryTime first, otherwise use first available candle after entryTime
          let optionCandle = getCandleAt(ohlcData, entryTime);
          
          if (!optionCandle) {
            optionCandle = getCandleAtOrAfter(ohlcData, entryTime);
            if (optionCandle) {
              optionEntryTimestamp = optionCandle.timestamp;
              optionEntryDelayMinutes = (optionCandle.timestamp - entryTime) / (60 * 1000);
            }
          } else {
            optionEntryTimestamp = optionCandle.timestamp;
            optionEntryDelayMinutes = 0;
          }
          
          const observedOptionOpen = optionCandle ? Number(optionCandle.open) : null;
          const observedOptionOpenIsValid = Number.isFinite(observedOptionOpen) && observedOptionOpen > 0;
          const theoreticalFallbackReason = optionCandle
            ? 'invalid_observed_option_open'
            : 'missing_observed_option_candle';
          optionEntryFallbackReason = observedOptionOpenIsValid ? null : theoreticalFallbackReason;
          C_entry = observedOptionOpenIsValid ? observedOptionOpen : null;

          if (observedOptionOpenIsValid) {
            C_entry_btc = C_entry;
            C_entry_usd = C_entry * S_entry;
            optionEntryPriceSource = 'observed';
            console.log(`C_entry: ${C_entry} (Entry delay: ${optionEntryDelayMinutes !== null ? optionEntryDelayMinutes.toFixed(2) : 'N/A'} minutes)`);

            // Calculate call P&L
            payoff = Math.max(S_settlement - selectedStrike, 0);
            pnlCall = btcPosition * ((C_entry * S_entry) - payoff);
            hasCall = true;

            console.log(`Payoff: ${payoff}, Call P&L: ${pnlCall}`);
          } else {
            console.log(`Observed option entry price unavailable: ${theoreticalFallbackReason}`);

            const theoreticalEntry = await getTheoreticalCallEntryPrice({
              entryTime,
              exitTime,
              S_entry,
              strike: selectedStrike
            });

            if (theoreticalEntry.ok) {
              C_entry = theoreticalEntry.theoreticalPremiumBtc;
              C_entry_btc = theoreticalEntry.theoreticalPremiumBtc;
              C_entry_usd = theoreticalEntry.theoreticalPremiumUsd;
              optionEntryTimestamp = entryTime;
              optionEntryDelayMinutes = 0;
              optionEntryPriceSource = 'theoretical';
              optionEntryModel = 'black76';
              optionEntryVolModel = 'garman_klass';
              optionEntryVol = theoreticalEntry.optionVol;
              optionEntryDiagnostics = JSON.stringify({
                volatility: theoreticalEntry.volatilityDiagnostics,
                pricing: theoreticalEntry.pricingDiagnostics,
                volatilitySource: THEORETICAL_VOL_SOURCE,
                volatilityLookbackDays: THEORETICAL_VOL_LOOKBACK_DAYS,
                volatilityWindowStart: new Date(theoreticalEntry.volStartTime).toISOString(),
                volatilityWindowEnd: new Date(theoreticalEntry.volEndTime).toISOString(),
                timeToExpiryYears: theoreticalEntry.timeToExpiryYears,
                riskFreeRate: THEORETICAL_RISK_FREE_RATE,
                theoreticalFallbackReason,
                observedOptionOpen: optionCandle ? optionCandle.open : null
              });

              payoff = Math.max(S_settlement - selectedStrike, 0);
              pnlCall = btcPosition * ((C_entry * S_entry) - payoff);
              hasCall = true;

              console.log('Using theoretical option entry fallback');
              console.log(`  model: Black-76 call, vol: Garman-Klass ${optionEntryVol}`);
              console.log(`  vol window: ${new Date(theoreticalEntry.volStartTime).toISOString()} to ${new Date(theoreticalEntry.volEndTime).toISOString()}`);
              console.log(`  theoretical premium USD: ${C_entry_usd}, BTC: ${C_entry_btc}`);
              console.log(`  payoff: ${payoff}, Call P&L: ${pnlCall}`);
            } else {
              optionEntryPriceSource = null;
              optionEntryDiagnostics = JSON.stringify({
                reason: theoreticalEntry.reason,
                theoreticalFallbackReason,
                observedOptionOpen: optionCandle ? optionCandle.open : null,
                volatility: theoreticalEntry.volatilityDiagnostics,
                pricing: theoreticalEntry.pricingDiagnostics
              });
              console.log(`Theoretical option entry fallback unavailable: ${theoreticalEntry.reason}`);
            }
          }
        } else {
          const intendedOption = selectStrike(
            strikes.map(strike => ({ instrument_name: null, strike })),
            target
          );
          selectedStrike = intendedOption ? intendedOption.strike : null;
          optionEntryFallbackReason = 'missing_observed_option_instrument';

          console.log('No observed option instruments found');
          console.log(`Using intended strike for synthetic theoretical entry: ${selectedStrike}`);

          if (selectedStrike !== null) {
            const theoreticalEntry = await getTheoreticalCallEntryPrice({
              entryTime,
              exitTime,
              S_entry,
              strike: selectedStrike
            });

            if (theoreticalEntry.ok) {
              C_entry = theoreticalEntry.theoreticalPremiumBtc;
              C_entry_btc = theoreticalEntry.theoreticalPremiumBtc;
              C_entry_usd = theoreticalEntry.theoreticalPremiumUsd;
              optionEntryTimestamp = entryTime;
              optionEntryDelayMinutes = 0;
              optionEntryPriceSource = 'theoretical';
              optionEntryModel = 'black76';
              optionEntryVolModel = 'garman_klass';
              optionEntryVol = theoreticalEntry.optionVol;
              optionEntryIsSynthetic = true;
              optionEntryDiagnostics = JSON.stringify({
                volatility: theoreticalEntry.volatilityDiagnostics,
                pricing: theoreticalEntry.pricingDiagnostics,
                volatilitySource: THEORETICAL_VOL_SOURCE,
                volatilityLookbackDays: THEORETICAL_VOL_LOOKBACK_DAYS,
                volatilityWindowStart: new Date(theoreticalEntry.volStartTime).toISOString(),
                volatilityWindowEnd: new Date(theoreticalEntry.volEndTime).toISOString(),
                timeToExpiryYears: theoreticalEntry.timeToExpiryYears,
                riskFreeRate: THEORETICAL_RISK_FREE_RATE,
                theoreticalFallbackReason: optionEntryFallbackReason,
                intendedStrike: selectedStrike,
                observedOptionInstrument: null
              });

              payoff = Math.max(S_settlement - selectedStrike, 0);
              pnlCall = btcPosition * ((C_entry * S_entry) - payoff);
              hasCall = true;

              console.log('Using synthetic theoretical option entry');
              console.log('  observed instrument: none');
              console.log(`  intended strike: ${selectedStrike}`);
              console.log(`  model: Black-76 call, vol: Garman-Klass ${optionEntryVol}`);
              console.log(`  vol window: ${new Date(theoreticalEntry.volStartTime).toISOString()} to ${new Date(theoreticalEntry.volEndTime).toISOString()}`);
              console.log(`  theoretical premium USD: ${C_entry_usd}, BTC: ${C_entry_btc}`);
              console.log(`  payoff: ${payoff}, Call P&L: ${pnlCall}`);
            } else {
              optionEntryPriceSource = null;
              optionEntryDiagnostics = JSON.stringify({
                reason: theoreticalEntry.reason,
                theoreticalFallbackReason: optionEntryFallbackReason,
                intendedStrike: selectedStrike,
                observedOptionInstrument: null,
                volatility: theoreticalEntry.volatilityDiagnostics,
                pricing: theoreticalEntry.pricingDiagnostics
              });
              console.log(`Synthetic theoretical option entry unavailable: ${theoreticalEntry.reason}`);
            }
          }
        }

        // Calculate total P&L
        const pnlTotal = pnlCall + pnlUnderlying;

        console.log(`Underlying P&L: ${pnlUnderlying}, Total P&L: ${pnlTotal}`);
        console.log(`Has Call: ${hasCall}\n`);

        // Initialize capital on first cycle, accounting for call premium if applicable
        if (capitalUsd === null) {
          if (hasCall && C_entry !== null) {
            capitalUsd = S_entry - (C_entry * S_entry * btcPosition);
            console.log(`Initial capital: ${capitalUsd.toFixed(2)} USD (1 BTC - premium)`);
          } else {
            capitalUsd = S_entry;
            console.log(`Initial capital: ${capitalUsd.toFixed(2)} USD (1 BTC)`);
          }
        }

        // Define capital transitions
        const capitalBefore = capitalUsd;
        const capitalAfter = capitalUsd + pnlTotal;
        const returnPct = capitalBefore > 0 ? pnlTotal / capitalBefore : 0;

        // Always record the cycle
        trades.push({
          cycle: i + 1,
          entry_date: entryDate.toISOString(),
          exit_date: exitDate.toISOString(),
          expiry: expiry,
          has_call: hasCall,
          option_instrument: selectedInstrument ? selectedInstrument.instrument_name : null,
          underlying: underlyingPriceSource,
          underlying_price_source: underlyingPriceSource,
          option_settlement_price_source: settlementPrice.source,
          option_settlement_price_source_resolved: settlementPrice.resolvedSource,
          option_settlement_price_source_type: settlementPrice.resolvedSourceType,
          option_settlement_price_fallback_occurred: settlementPrice.fallbackOccurred,
          option_settlement_price_fallback_reason: settlementPrice.fallbackReason ?? null,
          option_settlement_delivery_date: settlementPrice.deliveryDate ?? null,
          option_settlement_price_is_proxy: settlementPrice.isProxy,
          option_settlement_price_note: settlementPrice.note,
          strike: selectedStrike ?? null,
          S_entry: S_entry,
          C_entry: C_entry ?? null,
          C_entry_btc: C_entry_btc ?? null,
          C_entry_usd: C_entry_usd ?? null,
          option_entry_price_source: optionEntryPriceSource,
          option_entry_model: optionEntryModel,
          option_entry_vol_model: optionEntryVolModel,
          option_entry_vol: optionEntryVol,
          option_entry_fallback_reason: optionEntryFallbackReason,
          option_entry_is_synthetic: optionEntryIsSynthetic,
          option_entry_diagnostics: optionEntryDiagnostics,
          S_exit: S_exit,
          S_settlement: S_settlement,
          payoff: payoff ?? null,
          pnl_call: pnlCall,
          pnl_underlying: pnlUnderlying,
          pnl_total: pnlTotal,
          capital_before: capitalBefore,
          capital_after: capitalAfter,
          btc_position: btcPosition,
          return_pct: returnPct,
          weekly_vol: null,
          fallback_mode: fallbackMode,
          option_entry_timestamp: optionEntryTimestamp ?? null,
          option_entry_delay_minutes: optionEntryDelayMinutes ?? null
        });

        // Update capital and equity curve
        capitalUsd = capitalAfter;
        equityCurve.push({
          cycle: i + 1,
          capitalUsd: capitalUsd
        });

      } catch (error) {
        console.log(`Error in cycle: ${error.message}`);
      }
    }

    // Report results
    console.log('\n=== RESULTS ===\n');
    if (trades.length > 0) {
      const formattedTrades = trades.map(trade => ({
        cy: trade.cycle,
        entry: trade.entry_date ? trade.entry_date.substring(0, 16) : null,
        exit: trade.exit_date ? trade.exit_date.substring(0, 16) : null,
        expiry: trade.expiry,
        h: trade.has_call ? 'y' : 'n',
        option_instrument: trade.option_instrument,
        strike: trade.strike !== null ? Math.round(trade.strike) : null,
        S_entry: trade.S_entry !== null ? Number(trade.S_entry).toFixed(2) : null,
        S_exit: trade.S_exit !== null ? Number(trade.S_exit).toFixed(2) : null,
        S_settlement: trade.S_settlement !== null ? Number(trade.S_settlement).toFixed(2) : null,
        C_entry: trade.C_entry !== null ? Number(trade.C_entry).toFixed(4) : null,
        C_entry_usd: trade.C_entry_usd !== null ? Number(trade.C_entry_usd).toFixed(2) : null,
        price_src: trade.option_entry_price_source,
        model: trade.option_entry_model,
        vol_model: trade.option_entry_vol_model,
        opt_vol: trade.option_entry_vol !== null ? Number(trade.option_entry_vol).toFixed(4) : null,
        fallback_reason: trade.option_entry_fallback_reason,
        synthetic: trade.option_entry_is_synthetic,
        payoff: trade.payoff !== null ? Number(trade.payoff).toFixed(2) : null,
        pnl_c: trade.pnl_call.toFixed(2),
        pnl_u: trade.pnl_underlying.toFixed(2),
        pnl_t: trade.pnl_total.toFixed(2),
        cap_b: trade.capital_before.toFixed(2),
        cap_a: trade.capital_after.toFixed(2),
        btc_pos: Number(trade.btc_position).toFixed(4),
        'ret%': (trade.return_pct * 100).toFixed(2),
        vol: trade.weekly_vol
      }));
      console.table(formattedTrades);
      const summaryMetrics = buildSummaryMetrics(trades, capitalUsd);

      // Calculate summary metrics
      const bestTrade = Math.max(...trades.map(t => t.pnl_total));
      const worstTrade = Math.min(...trades.map(t => t.pnl_total));

      console.log('\n=== SUMMARY ===\n');
      console.log(`Initial BTC Price: ${summaryMetrics.initialBtcPrice.toFixed(2)} USD`);
      console.log(`Final BTC Price: ${summaryMetrics.finalBtcPrice.toFixed(2)} USD`);
      console.log(`Initial Capital: ${summaryMetrics.initialCapital.toFixed(2)} USD`);
      console.log(`Final Capital: ${summaryMetrics.finalCapital.toFixed(2)} USD`);
      console.log(`Run Return: ${summaryMetrics.runReturnPct.toFixed(2)}%`);
      console.log(`BTC Return: ${summaryMetrics.btcReturnPct.toFixed(2)}%`);
      console.log(`Annualized Volatility of Weekly Returns: ${summaryMetrics.annualizedVolatilityOfWeeklyReturnsPct !== null ? summaryMetrics.annualizedVolatilityOfWeeklyReturnsPct.toFixed(2) : 'N/A'}%`);
      console.log(`\nBest Trade: ${bestTrade.toFixed(2)} USD`);
      console.log(`Worst Trade: ${worstTrade.toFixed(2)} USD`);
      console.log(`\nCall Weeks: ${summaryMetrics.callWeeks} / ${summaryMetrics.totalWeeks}`);
      console.log(`Observed Option Weeks: ${summaryMetrics.observedOptionWeeks}`);
      console.log(`Theoretical Fallback Weeks: ${summaryMetrics.theoreticalFallbackWeeks}`);
      console.log(`Synthetic Option Weeks: ${summaryMetrics.syntheticOptionWeeks}`);
      console.log(`Missing Observed Instrument Weeks: ${summaryMetrics.missingObservedInstrumentWeeks}`);
      console.log(`Missing Observed Candle Weeks: ${summaryMetrics.missingObservedCandleWeeks}`);
      console.log(`Invalid Observed Open Weeks: ${summaryMetrics.invalidObservedOpenWeeks}`);
      console.log(`Settlement Fallback Weeks: ${summaryMetrics.settlementFallbackWeeks}`);
      console.log(`\nTotal Call P&L: ${summaryMetrics.totalPnLCall.toFixed(2)} USD`);
      console.log(`Total Underlying P&L: ${summaryMetrics.totalPnLUnderlying.toFixed(2)} USD`);
      console.log(`Total P&L: ${summaryMetrics.totalPnL.toFixed(2)} USD`);

      console.log('\n=== EQUITY CURVE ===\n');
      console.table(equityCurve);
    } else {
      console.log('No trades collected.');
    }

    const summary = {
      tenor,
      ...buildSummaryMetrics(trades, capitalUsd)
    };

    return {
      config: normalizedConfig,
      trades,
      equityCurve,
      summary
    };
  } catch (error) {
    console.error('Error:', error.message);
    return {
      config: normalizedConfig,
      trades: [],
      equityCurve: [],
      summary: {
        tenor,
        initialCapital: 0,
        finalCapital: 0,
        totalPnLCall: 0,
        totalPnLUnderlying: 0,
        totalPnL: 0,
        callWeeks: 0,
        totalWeeks: 0,
        observedOptionWeeks: 0,
        theoreticalFallbackWeeks: 0,
        syntheticOptionWeeks: 0,
        missingObservedInstrumentWeeks: 0,
        missingObservedCandleWeeks: 0,
        invalidObservedOpenWeeks: 0,
        settlementFallbackWeeks: 0,
        initialBtcPrice: 0,
        finalBtcPrice: 0,
        runReturnPct: 0,
        btcReturnPct: 0,
        annualizedVolatilityOfWeeklyReturns: null,
        annualizedVolatilityOfWeeklyReturnsPct: null
      }
    };
  }
}

if (require.main === module) {
  runStrategy({});
}

module.exports = { runStrategy, generateCycles };
