// ====== DOMAIN CHECKER FRONTEND ======

function isValidDomain(domain) {
  const domainRegex = /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain.trim().toLowerCase());
}

function setupDomainChecker() {
  const domainInput = document.getElementById('customDomain');
  const checkBtn = document.getElementById('checkDomainBtn');
  const resultDisplay = document.getElementById('domainCheckResult');
  const buyButton = document.getElementById('deployFullHosting');
  const priceDisplay = document.getElementById('domainPriceDisplay');
  const durationSelect = document.getElementById('domainDuration');
  const confirmBtn = document.getElementById('confirmDomainBtn');

  if (!domainInput || !checkBtn || !resultDisplay || !buyButton) return;

  // ✅ Detect backend base URL
  // 1. Use PUBLIC_BACKEND_URL from environment if defined (Render or Netlify)
  // 2. Else fallback to current origin (for local dev)
  // 3. Else fallback to localhost:3000 if opened via file://
  const backendHost =
    window.PUBLIC_BACKEND_URL ||
    (window.location.protocol.startsWith('http')
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000');

  // ------------------------
  // Input validation
  // ------------------------
  domainInput.addEventListener('input', () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain) {
      resultDisplay.textContent = '';
      buyButton.disabled = true;
      confirmBtn.disabled = true;
      return;
    }

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Invalid domain format';
      resultDisplay.style.color = 'red';
      buyButton.disabled = true;
      confirmBtn.disabled = true;
    } else {
      resultDisplay.textContent = '✅ Valid format. Click "Check Availability"';
      resultDisplay.style.color = 'blue';
      buyButton.disabled = true;
      confirmBtn.disabled = true;
    }
  });

  // ------------------------
  // Check availability
  // ------------------------
  checkBtn.addEventListener('click', async () => {
    const domain = domainInput.value.trim().toLowerCase();
    resultDisplay.textContent = '';
    buyButton.disabled = true;
    confirmBtn.disabled = true;
    if (priceDisplay) priceDisplay.textContent = '';

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Please enter a valid domain name.';
      resultDisplay.style.color = 'red';
      return;
    }

    resultDisplay.textContent = 'Checking availability...';
    resultDisplay.style.color = 'black';

    try {
      const checkRes = await fetch(`${backendHost}/full-hosting/domain/check?domain=${encodeURIComponent(domain)}`);
      if (!checkRes.ok) throw new Error(`Server responded with ${checkRes.status}`);
      const { available } = await checkRes.json();

      if (!available) {
        resultDisplay.textContent = `❌ "${domain}" is not available.`;
        resultDisplay.style.color = 'red';
        return;
      }

      resultDisplay.textContent = `✅ "${domain}" is available!`;
      resultDisplay.style.color = 'green';
      confirmBtn.disabled = false;

      localStorage.setItem('customDomain', domain);

      // ✅ Get price
      const duration = durationSelect?.value || '1';
      localStorage.setItem('domainDuration', duration);

      const priceRes = await fetch(`${backendHost}/full-hosting/domain/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, duration })
      });

      if (!priceRes.ok) throw new Error('Price fetch failed');
      const priceData = await priceRes.json();
      const base = parseFloat(priceData.domainPrice || 0);
      const final = (base + 150).toFixed(2);
      localStorage.setItem('domainPrice', base);

      if (priceDisplay) {
        priceDisplay.textContent = `💷 Estimated Price: £${base.toFixed(2)} + £150 service = £${final}`;
        priceDisplay.style.color = 'black';
      }
    } catch (err) {
      console.error('❌ Domain check error:', err);
      resultDisplay.textContent = '⚠️ Error checking domain. Please try again.';
      resultDisplay.style.color = 'orange';
      buyButton.disabled = true;
      confirmBtn.disabled = true;
    }
  });

  // ------------------------
  // Update price when duration changes
  // ------------------------
  durationSelect?.addEventListener('change', async () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!isValidDomain(domain)) return;
    localStorage.setItem('domainDuration', durationSelect.value);

    if (!resultDisplay.textContent.includes('available')) return;

    try {
      const res = await fetch(`${backendHost}/full-hosting/domain/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, duration: durationSelect.value })
      });
      if (!res.ok) throw new Error('Estimate failed');
      const data = await res.json();
      const base = parseFloat(data.domainPrice || 0);
      const final = (base + 150).toFixed(2);
      localStorage.setItem('domainPrice', base);

      if (priceDisplay) {
        priceDisplay.textContent = `💷 Estimated Price: £${base.toFixed(2)} + £150 service = £${final}`;
        priceDisplay.style.color = 'black';
      }
    } catch (err) {
      console.error('⚠️ Price recheck error:', err);
      if (priceDisplay) {
        priceDisplay.textContent = '⚠️ Could not re-estimate price.';
        priceDisplay.style.color = 'orange';
      }
    }
  });

  // ------------------------
  // Confirm domain
  // ------------------------
  confirmBtn?.addEventListener('click', () => {
    confirmBtn.textContent = '✅ Domain Confirmed';
    confirmBtn.disabled = true;
    buyButton.disabled = false;
  });
}

// ✅ Initialize
window.setupDomainChecker = setupDomainChecker;
