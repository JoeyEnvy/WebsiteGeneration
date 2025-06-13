function setupDomainChecker() {
  const domainInput = document.getElementById('customDomain');
  const checkBtn = document.getElementById('checkDomainBtn');
  const resultDisplay = document.getElementById('domainCheckResult');
  const buyButton = document.getElementById('deployFullHosting');

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
    resultDisplay.style.color = 'black';
    buyButton.disabled = true;

    const priceDisplay = document.getElementById('domainPriceDisplay');
    if (priceDisplay) priceDisplay.textContent = '';

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Please enter a valid domain name.';
      resultDisplay.style.color = 'red';
      return;
    }

    resultDisplay.textContent = 'Checking...';

    try {
      const res = await fetch('https://websitegeneration.onrender.com/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();

      if (data.available) {
        resultDisplay.textContent = `✅ "${domain}" is available!`;
        resultDisplay.style.color = 'green';
        buyButton.disabled = false;

        localStorage.setItem('customDomain', domain);

        try {
          const priceRes = await fetch('https://websitegeneration.onrender.com/get-domain-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              domain,
              duration: document.getElementById('domainDuration')?.value || '1'
            })
          });

          if (!priceRes.ok) throw new Error(`Estimate failed: ${priceRes.status}`);
          const priceData = await priceRes.json();
          const price = parseFloat(priceData.domainPrice || 0);
          const final = price.toFixed(2);

          if (priceDisplay) {
            priceDisplay.textContent = `💷 Estimated Price: £${final} + £150 service = £${(price + 150).toFixed(2)}`;
            priceDisplay.style.color = 'black';
          }
        } catch (err) {
          console.error('Price estimate error:', err);
          if (priceDisplay) {
            priceDisplay.textContent = '⚠️ Could not retrieve domain price.';
            priceDisplay.style.color = 'orange';
          }
        }
      } else {
        resultDisplay.textContent = `❌ "${domain}" is not available.`;
        resultDisplay.style.color = 'red';
      }
    } catch (err) {
      resultDisplay.textContent = '⚠️ Error checking domain. Please try again.';
      resultDisplay.style.color = 'orange';
      buyButton.disabled = true;
      console.error('Domain check error:', err);
    }
  });

  const durationSelect = document.getElementById('domainDuration');
  if (durationSelect) {
    durationSelect.addEventListener('change', async () => {
      const domain = domainInput.value.trim().toLowerCase();
      const priceDisplay = document.getElementById('domainPriceDisplay');
      const resultDisplay = document.getElementById('domainCheckResult');

      if (!isValidDomain(domain)) return;
      localStorage.setItem('domainDuration', durationSelect.value);
      if (!resultDisplay.textContent.includes('available')) return;

      try {
        const res = await fetch('https://websitegeneration.onrender.com/get-domain-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain,
            duration: durationSelect.value
          })
        });

        if (!res.ok) throw new Error('Estimate failed');
        const { domainPrice } = await res.json();

        const base = parseFloat(domainPrice || 0);
        if (priceDisplay) {
          priceDisplay.textContent = `💷 Estimated Price: £${base.toFixed(2)} + £150 service = £${(base + 150).toFixed(2)}`;
          priceDisplay.style.color = 'black';
        }
      } catch (err) {
        console.error('Price recheck error:', err);
        if (priceDisplay) {
          priceDisplay.textContent = '⚠️ Could not re-estimate price.';
          priceDisplay.style.color = 'orange';
        }
      }
    });
  }
}

// ✅ Make sure it's globally accessible for init.js
window.setupDomainChecker = setupDomainChecker;

