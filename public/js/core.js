// public/js/core.js – FINAL FIXED VERSION (November 22, 2025)
// Supports Vercel, Render, localhost, and full GoDaddy auto-purchase

// ————————————————————————————————————————————————
// 1. GLOBAL API BASE – automatically detects correct backend
// ————————————————————————————————————————————————
window.API_BASE = (() => {
  // 1. Manual override (for testing)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:10000'; // Change if your local backend uses different port
  }
  // 2. Vercel production
  if (window.location.hostname.includes('vercel.app') || window.location.hostname === 'website-generation.vercel.app') {
    return 'https://website-generation.vercel.app/api';
  }
  // 3. Render production (fallback)
  return 'https://websitegeneration.onrender.com';
})();

// ————————————————————————————————————————————————
// 2. Clear old generated site on full refresh (prevents preview bugs)
// ————————————————————————————————————————————————
window.addEventListener('beforeunload', (e) => {
  // Only clear if it's a full page reload (not SPA navigation)
  if (!e.isTrusted || performance.navigation?.type === 1) return;
  localStorage.removeItem('generatedPages');
  localStorage.removeItem('currentSiteId');
  localStorage.removeItem('customDomain');
  localStorage.removeItem('domainDuration');
});

// ————————————————————————————————————————————————
// 3. Debounce utility (used in live editing, search, etc.)
// ————————————————————————————————————————————————
window.debounce = function(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// ————————————————————————————————————————————————
// 4. Enhanced domain validation (strict, real-world compliant)
// ————————————————————————————————————————————————
window.isValidDomain = function(domain) {
  if (!domain || typeof domain !== 'string') return false;
  domain = domain.trim().toLowerCase();

  // Basic length & format
  if (domain.length > 253 || domain.length < 1) return false;
  if (domain.includes(' ') || domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) return false;

  // Full regex (RFC-compliant)
  const domainRegex = /^(?!-)(?!.*--)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/;
  if (!domainRegex.test(domain)) return false;

  // Check each label (part between dots) ≤63 chars and no double hyphens
  return domain.split('.').every(label => {
    return label.length <= 63 && !label.includes('--') && /^[a-z0-9-]+$/g.test(label);
  });
};

// ————————————————————————————————————————————————
// 5. Universal API fetcher (used by ALL deployment routes)
// ————————————————————————————————————————————————
window.apiFetch = async function(path, options = {}) {
  const url = `${window.API_BASE}${path.startsWith('/') ? path : '/' + path}`;

  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    ...options
  };

  // Auto-stringify body
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }
    return data;
  } catch (err) {
    console.error('API Fetch failed:', err.message);
    throw err;
  }
};

// ————————————————————————————————————————————————
// 6. Ready confirmation
// ————————————————————————————————————————————————
console.log('%cWebsiteGeneration.co.uk – core.js LOADED SUCCESSFULLY', 'color:#00ff88; font-weight:bold; font-size:14px;');
console.log('%cAPI Base → ' + window.API_BASE, 'color:#88ccff; font-weight:bold;');