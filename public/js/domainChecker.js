function setupDomainChecker() {
  const domainInput = document.getElementById('customDomain');
  const checkBtn = document.getElementById('checkDomainBtn');
  const resultDisplay = document.getElementById('domainCheckResult');
  const buyButton = document.getElementById('deployFullHosting');
  const priceDisplay = document.getElementById('domainPriceDisplay');
  const durationSelect = document.getElementById('domainDuration');
  const confirmBtn = document.getElementById('confirmDomainBtn');

  if (!domainInput || !checkBtn || !resultDisplay || !buyButton) return;

  domainInput.addEventListener('input', () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain) {
      resultDisplay.textContent = '';
      return;
    }

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Invalid domain format';
      resultDisplay.style.color = 'red';
      buyButton.disabled = true;
    } else {
      resultDisplay.textContent = '✅ Valid format. Click "Check Availability"';
      resultDisplay.style.color = 'blue';
    }
  });

  checkBtn.addEventListener('click', async () => {
    const domain = domainInput.value.trim().toLowerCase();
    resultDisplay.textContent = '';
    buyButton.disabled = true;
    if (priceDisplay) priceDisplay.textContent = '';

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Please enter a valid domain name.';
      resultDisplay.style.color = 'red';
      return;
    }

    resultDisplay.textContent = 'Checking...';

    try {
      const checkRes = await fetch('https://websitegeneration.onrender.com/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });

      if (!checkRes.ok) throw new Error(`Server responded with ${checkRes.status}`);
      const { available, domainPrice, currency } = await checkRes.json();

      if (!available) {
        resultDisplay.textContent = `❌ "${domain}" is not available.`;
        resultDisplay.style.color = 'red';
        return;
      }

      resultDisplay.textContent = `✅ "${domain}" is available!`;
      resultDisplay.style.color = 'green';
      if (confirmBtn) confirmBtn.disabled = false;
      buyButton.disabled = true;

      localStorage.setItem('customDomain', domain);

      const duration = durationSelect?.value || '1';
      localStorage.setItem('domainDuration', duration);

// 🔁 NEW backend price request
const priceRes = await fetch('https://websitegeneration.onrender.com/get-domain-price', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ domain, duration })
});

if (!priceRes.ok) throw new Error('Price fetch failed');
const { domainPrice } = await priceRes.json();
localStorage.setItem('domainPrice', domainPrice);

const base = parseFloat(domainPrice || 0);
const final = (base + 150).toFixed(2);

if (priceDisplay) {
  priceDisplay.textContent = `💷 Estimated Price: £${base.toFixed(2)} + £150 service = £${final}`;
  priceDisplay.style.color = 'black';
}


    } catch (err) {
      console.error('❌ Domain check error:', err);
      resultDisplay.textContent = '⚠️ Error checking domain. Please try again.';
      resultDisplay.style.color = 'orange';
      buyButton.disabled = true;
    }
  });

  durationSelect?.addEventListener('change', async () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!isValidDomain(domain)) return;
    localStorage.setItem('domainDuration', durationSelect.value);

    if (!resultDisplay.textContent.includes('available')) return;

    try {
      const res = await fetch('https://websitegeneration.onrender.com/get-domain-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, duration: durationSelect.value })
      });

      if (!res.ok) throw new Error('Estimate failed');
      const { domainPrice, currency } = await res.json();
      const base = parseFloat(domainPrice || 0);
      const final = (base + 150).toFixed(2);

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

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      confirmBtn.textContent = '✅ Domain Confirmed';
      confirmBtn.disabled = true;
      buyButton.disabled = false;
    });
  }
}

// ✅ Expose to window
window.setupDomainChecker = setupDomainChecker;

