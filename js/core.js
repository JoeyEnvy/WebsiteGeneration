// Global API base (Vercel backend)
window.API_BASE = "https://website-generation.vercel.app/api";

// Clear previous site data on hard refresh
window.addEventListener('beforeunload', () => {
  localStorage.removeItem('generatedPages');
});

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Domain validation utility
function isValidDomain(domain) {
  const domainRegex = /^(?!-)(?!.*--)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain) &&
         domain.length <= 253 &&
         !domain.includes(' ') &&
         !domain.startsWith('.') &&
         !domain.endsWith('.');
}
