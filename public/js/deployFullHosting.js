const deployFullHostingBtn = document.getElementById('deployFullHosting');

// Simple domain validator
const isValidDomain = d => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(String(d || ''));

if (deployFullHostingBtn) {
  deployFullHostingBtn.addEventListener('click', async () => {
    const domainInput = document.getElementById('customDomain');
    const durationSelect = document.getElementById('domainDuration');
    const priceDisplay = document.getElementById('domainPriceDisplay');

    const domain = domainInput?.value?.trim().toLowerCase();
    const durationYears = parseInt(durationSelect?.value, 10) || 1;
    const businessName = (localStorage.getItem('businessName') || '').trim();
    let sessionId = localStorage.getItem('sessionId');

    if (!domain || !isValidDomain(domain)) {
      alert('❌ Please enter a valid domain.');
      return;
    }

    if (!businessName) {
      alert('⚠️ Please complete business info first.');
      return;
    }

    if (!sessionId) {
      sessionId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now());
      localStorage.setItem('sessionId', sessionId);
    }

    // Persist exact selections for the success step
    localStorage.setItem('customDomain', domain);
    localStorage.setItem('domainDuration', String(durationYears));

    // Optional: persist shown price if present
    if (priceDisplay?.textContent) {
      const match = priceDisplay.textContent.match(/£(\d+(\.\d+)?)/);
      if (match) localStorage.setItem('domainPrice', match[1]);
    }

    try {
      const res = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'full-hosting',   // GitHub full-hosting
          sessionId,
          domain,
          durationYears,          // ✅ matches backend
          businessName
        })
      });

      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        alert('⚠️ Failed to create checkout session.');
        console.error(data);
      }
    } catch (err) {
      alert('❌ Error creating Stripe session. Check console.');
      console.error('Stripe checkout error:', err);
    }
  });
}

