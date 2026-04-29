function getAvailableOptionsAt(instruments, timestamp) {
  return instruments.filter(instrument => {
    return (
      instrument.option_type === 'call' &&
      instrument.creation_timestamp <= timestamp &&
      instrument.expiration_timestamp > timestamp
    );
  });
}

function getNextExpiry(options, timestamp) {
  const expirations = [...new Set(options.map(opt => opt.expiration_timestamp))];
  const futureExpirations = expirations.filter(exp => exp > timestamp);
  futureExpirations.sort((a, b) => a - b);
  return futureExpirations[0] || null;
}

function filterByExpiry(options, expiry) {
  return options.filter(option => option.expiration_timestamp === expiry);
}

function selectStrike(options, target) {
  let bestOption = null;
  let minDistance = Infinity;

  for (const option of options) {
    const distance = Math.abs(option.strike - target);
    
    if (distance < minDistance) {
      minDistance = distance;
      bestOption = option;
    } else if (distance === minDistance) {
      const isAboveTarget = option.strike > target;
      const currentIsAbove = bestOption.strike > target;
      if (isAboveTarget && !currentIsAbove) {
        bestOption = option;
      }
    }
  }

  return bestOption;
}

module.exports = { getAvailableOptionsAt, getNextExpiry, filterByExpiry, selectStrike };
