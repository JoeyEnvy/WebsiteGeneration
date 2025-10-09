// ========================================================================
// utils/domainPricing.js — Clean, clear, Porkbun-compatible pricing util
// ========================================================================

export const TLD_PRICES = {
  org: 500,   // £5.00
  xyz: 650,   // £6.50
  com: 800,   // £8.00
  net: 1000,  // £10.00
  co: 1499,   // £14.99
  ltd: 300,   // £3.00
  ai: 2999,   // £29.99
  io: 4999    // £49.99
};

/**
 * 🧮 Convert a domain’s TLD to its per-year price (in £)
 * @param {string} domain - Full domain name (e.g. example.com)
 * @param {number} period - Years (defaults to 1)
 * @returns {number} - Price in pounds, rounded to 2 decimals
 */
export function getDomainPriceInPounds(domain, period = 1) {
  if (!domain) return 0;
  const tld = domain.split(".").pop().toLowerCase();
  const base = TLD_PRICES[tld] || 1599; // fallback: £15.99
  const total = base * Math.max(1, parseInt(period, 10) || 1);
  return parseFloat((total / 100).toFixed(2));
}

/**
 * 🧾 Get raw integer price (pence)
 * @param {string} domain
 * @param {number} period
 * @returns {number}
 */
export function getDomainPriceInPennies(domain, period = 1) {
  if (!domain) return 0;
  const tld = domain.split(".").pop().toLowerCase();
  const base = TLD_PRICES[tld] || 1599;
  return base * Math.max(1, parseInt(period, 10) || 1);
}
