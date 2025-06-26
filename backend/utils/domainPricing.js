// utils/domainPricing.js
import fetch from 'node-fetch';

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

export async function getLiveDomainPrice(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const url = `https://api.godaddy.com/v1/domains/price/${tld}?domainName=${domain}`;

  const headers = {
    Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
    Accept: 'application/json'
  };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GoDaddy price fetch failed: ${errorText}`);
  }

  const data = await res.json();
  return data.price; // in base unit (e.g., 2.99)
}

