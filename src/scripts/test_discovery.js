const { getOHLCData, getIndexChartOhlcData } = require('../data/deribit');
const { selectStrike } = require('../data/discovery');
const { getCandleAt, getCandleAtOrAfter } = require('../data/ohlc');
const { computeGarmanKlassVolatility } = require('../models/volatility/garman_klass');
const { black76CallPrice } = require('../models/options/black76');

const OPTION_SETTLEMENT_PRICE_SOURCE_MAP = {
  DERIBIT_BTC_USD_INDEX_OHLC_PROXY: {
    type: 'deribit_index_chart',
    indexName: 'btc_usd',
    range: '1h'
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

function getNearestCandleWithinTolerance(chartData, timestamp, toleranceMs) {
  if (!chartData || !Array.isArray(chartData.ticks)) return null;

  let nearestIndex = -1;
  let nearestDistance = Infinity;

  for (let index = 0; index < chartData.ticks.length; index++) {
    const tick = chartData.ticks[index];
    const distance = Math.abs(tick - timestamp);

    if (distance <= toleranceMs && distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }

  if (nearestIndex === -1) return null;

  return {
    timestamp: chartData.ticks[nearestIndex],
    open: chartData.open[nearestIndex],
    high: chartData.high[nearestIndex],
    low: chartData.low[nearestIndex],
    close: chartData.close[nearestIndex],
    volume: chartData.volume[nearestIndex],
    distanceMs: nearestDistance
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

  try {
    const data = mappedSource.type === 'deribit_index_chart'
      ? await getIndexChartOhlcData(mappedSource.indexName, exitTime - window, exitTime + window, mappedSource.range)
      : await getOHLCData(mappedSource.instrumentName, exitTime, exitTime + window, 60);
    const candle = mappedSource.type === 'deribit_index_chart'
      ? getNearestCandleWithinTolerance(data, exitTime, window)
      : getCandleAt(data, exitTime) || getCandleAtOrAfter(data, exitTime);

    if (candle && candle.open) {
      return {
        price: candle.open,
        source,
        resolvedSource: mappedSource.indexName || mappedSource.instrumentName,
        resolvedSourceType: mappedSource.type,
        fallbackOccurred: false,
        settlementTimestamp: candle.timestamp,
        settlementTimestampDistanceMs: candle.distanceMs ?? 0,
        isProxy: true,
        note: source === 'DERIBIT_BTC_USD_INDEX_OHLC_PROXY'
          ? 'Deribit btc_usd index chart proxy; official delivery price / 30-min TWAP not implemented'
          : null
      };
    }
  } catch (error) {
    // Fall through to explicit compatibility fallback below.
  }

  return {
    price: fallbackPrice,
    source,
    resolvedSource: 'BTC-PERPETUAL',
    resolvedSourceType: 'instrument_ohlc',
    fallbackOccurred: true,
    isProxy: true,
    note: 'Settlement index proxy unavailable; using BTC exposure exit price as explicit compatibility fallback'
  };
}

async function runStrategy(config = {}) {
  const underlyingPriceSource = config.underlyingPriceSource || config.underlying || 'BTC-PERPETUAL';
  const optionSettlementPriceSource = config.optionSettlementPriceSource || 'DERIBIT_BTC_USD_INDEX_OHLC_PROXY';
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
    entryHourUtc,
    entryMinuteUtc
  };

  try {
    const startDateObj = new Date(startDate);
    // Date-only endDate values mean "through the cycle exit on that date".
    // Full timestamps remain exact, so 2025-12-26T00:00:00Z stays midnight.
    const endDateObj = parseEndDateForCycleBoundary(endDate, CURRENT_EXIT_HOUR_UTC, CURRENT_EXIT_MINUTE_UTC);
    const cycles = generateFridayCycles(startDateObj, endDateObj, entryHourUtc, entryMinuteUtc);
    const trades = [];
    const equityCurve = [];
    let capitalUsd = null;

    console.log(`Running ${cycles.length} weekly cycles from ${startDateObj.toISOString()} to ${endDateObj.toISOString()}\n`);

    for (let i = 0; i < cycles.length; i++) {
      const cycle = cycles[i];
      const entryTime = cycle.entry;
      const exitTime = cycle.exit;

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
          option_settlement_timestamp: settlementPrice.settlementTimestamp ?? null,
          option_settlement_timestamp_distance_ms: settlementPrice.settlementTimestampDistanceMs ?? null,
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
      const totalPnLCall = trades.reduce((sum, trade) => sum + trade.pnl_call, 0);
      const totalPnLUnderlying = trades.reduce((sum, trade) => sum + trade.pnl_underlying, 0);
      const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl_total, 0);
      const callCount = trades.filter(trade => trade.has_call).length;

      // Calculate summary metrics
      const initialBtcPrice = trades[0].S_entry;
      const initialCapital = trades[0].capital_before;
      const finalCapital = capitalUsd;
      const lastS_exit = trades[trades.length - 1].S_exit;
      const runReturn = ((finalCapital / initialCapital) - 1) * 100;
      const btcReturn = ((lastS_exit / initialBtcPrice) - 1) * 100;
      const bestTrade = Math.max(...trades.map(t => t.pnl_total));
      const worstTrade = Math.min(...trades.map(t => t.pnl_total));

      console.log('\n=== SUMMARY ===\n');
      console.log(`Initial BTC Price: ${initialBtcPrice.toFixed(2)} USD`);
      console.log(`Initial Capital: ${initialCapital.toFixed(2)} USD`);
      console.log(`Final Capital: ${finalCapital.toFixed(2)} USD`);
      console.log(`Run Return: ${runReturn.toFixed(2)}%`);
      console.log(`BTC Return: ${btcReturn.toFixed(2)}%`);
      console.log(`\nBest Trade: ${bestTrade.toFixed(2)} USD`);
      console.log(`Worst Trade: ${worstTrade.toFixed(2)} USD`);
      console.log(`\nCall Weeks: ${callCount} / ${trades.length}`);
      console.log(`Total Call P&L: ${totalPnLCall.toFixed(2)} USD`);
      console.log(`Total Underlying P&L: ${totalPnLUnderlying.toFixed(2)} USD`);
      console.log(`Total P&L: ${totalPnL.toFixed(2)} USD`);

      console.log('\n=== EQUITY CURVE ===\n');
      console.table(equityCurve);
    } else {
      console.log('No trades collected.');
    }

    const summary = {
      initialCapital: trades.length > 0 ? trades[0].capital_before : 0,
      finalCapital: capitalUsd,
      totalPnLCall: trades.reduce((sum, trade) => sum + trade.pnl_call, 0),
      totalPnLUnderlying: trades.reduce((sum, trade) => sum + trade.pnl_underlying, 0),
      totalPnL: trades.reduce((sum, trade) => sum + trade.pnl_total, 0),
      callWeeks: trades.filter(trade => trade.has_call).length,
      totalWeeks: trades.length
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
        initialCapital: 0,
        finalCapital: 0,
        totalPnLCall: 0,
        totalPnLUnderlying: 0,
        totalPnL: 0,
        callWeeks: 0,
        totalWeeks: 0
      }
    };
  }
}

if (require.main === module) {
  runStrategy({});
}

module.exports = { runStrategy };
