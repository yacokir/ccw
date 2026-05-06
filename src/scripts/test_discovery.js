const { getOHLCData } = require('../data/deribit');
const { selectStrike } = require('../data/discovery');
const { getCandleAt, getCandleAtOrAfter } = require('../data/ohlc');

const OPTION_SETTLEMENT_PRICE_SOURCE_MAP = {
  DERIBIT_BTC_USD_INDEX_OHLC_PROXY: 'BTC_USD'
};

const CURRENT_EXIT_HOUR_UTC = 8;
const CURRENT_EXIT_MINUTE_UTC = 0;

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

async function getOptionSettlementPrice(source, exitTime, window, fallbackPrice) {
  const mappedSource = OPTION_SETTLEMENT_PRICE_SOURCE_MAP[source] || source;

  try {
    const data = await getOHLCData(mappedSource, exitTime, exitTime + window, 60);
    const candle = getCandleAt(data, exitTime);

    if (candle && candle.open) {
      return {
        price: candle.open,
        source,
        resolvedSource: mappedSource,
        isProxy: true,
        note: source === 'DERIBIT_BTC_USD_INDEX_OHLC_PROXY'
          ? 'Deribit BTC USD index OHLC proxy; official delivery price / 30-min TWAP not implemented'
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
    isProxy: true,
    note: 'Settlement source unavailable; using BTC exposure exit price as explicit compatibility fallback'
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
        let payoff = null;
        let optionEntryTimestamp = null;
        let optionEntryDelayMinutes = null;

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
          
          C_entry = optionCandle ? optionCandle.open : null;

          if (C_entry) {
            console.log(`C_entry: ${C_entry} (Entry delay: ${optionEntryDelayMinutes !== null ? optionEntryDelayMinutes.toFixed(2) : 'N/A'} minutes)`);

            // Calculate call P&L
            payoff = Math.max(S_settlement - selectedStrike, 0);
            pnlCall = btcPosition * ((C_entry * S_entry) - payoff);
            hasCall = true;

            console.log(`Payoff: ${payoff}, Call P&L: ${pnlCall}`);
          } else {
            console.log('Entry candle not found for option within delay window');
          }
        } else {
          console.log('No valid instruments found - no call week');
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
          option_settlement_price_is_proxy: settlementPrice.isProxy,
          option_settlement_price_note: settlementPrice.note,
          strike: selectedStrike ?? null,
          S_entry: S_entry,
          C_entry: C_entry ?? null,
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
