// utils/domainPricing.js

// utils/domainPricing.js

export const TLD_PRICES = {
  org: 500,
  xyz: 650,
  com: 800,
  net: 1000,
  co: 1499,
  ltd: 300,     // ✅ £3 for .ltd
  ai: 2999,
  io: 4999
};

export function getDomainPriceInPounds(domain, period = 1) {
  const tld = domain.split('.').pop().toLowerCase();
  const base = TLD_PRICES[tld] || 1599;
  const total = base * period;
  return parseFloat((total / 100).toFixed(2));
}

export function getDomainPriceInPennies(domain, period = 1) {
  const tld = domain.split('.').pop().toLowerCase();
  const base = TLD_PRICES[tld] || 1599;
  return base * period;
}
