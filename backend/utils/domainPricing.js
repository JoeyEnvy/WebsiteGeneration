// utils/domainPricing.js
export const TLD_PRICES = {
  org: 500,
  xyz: 650,
  com: 800,
  net: 1000,
  co: 1499,
  ltd: 300,
  ai: 2999,
  io: 4999
};

/**
 * Returns domain price in pounds (£) for a given domain and period (years)
 */
export function getDomainPriceInPounds(domain, period = 1) {
  const tld = domain.split('.').pop().toLowerCase();
  const base = TLD_PRICES[tld] || 1599; // fallback price if TLD not listed
  const total = base * period;
  return parseFloat((total / 100).toFixed(2));
}

/**
 * Returns domain price in pennies (integer) for a given domain and period
 */
export function getDomainPriceInPennies(domain, period = 1) {
  const tld = domain.split('.').pop().toLowerCase();
  const base = TLD_PRICES[tld] || 1599;
  return base * period;
}
