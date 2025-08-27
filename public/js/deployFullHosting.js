// public/js/deployFullHosting.js

const deployFullHostingBtn = document.getElementById('deployFullHosting');

// Guarded once-only helper to avoid "Identifier ... already been declared"
window.isValidDomain = window.isValidDomain || function (d) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(String(d || ''));
};

if (deployFullHostingBtn) {
  deployFullHostingBtn.addEventListener('click', async () => {
    const domainInput   = document.getElementById('customDomain');
    const durationSelect = document.getElementById('domainDuration');
    const priceDisplay  = document.getElementById('domainPriceDisplay');

    const domain = domainInput?.value?.trim().toLowerCase();
    const durationYears = parseInt(durationSelect?.value, 10) || 1;
    const businessName  = (localStorage.getItem('businessName') || '').trim();
    let sessionId       = localStorage.getItem('sessionId');

    // Basic guards
    if (!domain || !window.isValidDomain(domain)) {
      alert('❌ Please enter a valid domain.');
      return;
    }
    if (!businessName) {
      alert('⚠️ Please complete business info first.');
      return;
    }

    // Ensure a sessionId
    if (!sessionId) {
      sessionId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now());
      localStorage.setItem('sessionId', sessionId);
    }

    // Persist exact selections for the success step
    localStorage.setItem('customDomain', domain);
    localStorage.setItem('domainDuration', String(durationYears));

    // Optional: persist shown price if present (display only)
    if (priceDisplay?.textContent) {
      const match = priceDisplay.textContent.match(/£(\d+(\.\d+)?)/);
      if (match) localStorage.setItem('domainPrice', match[1]);
    }

    // UI: disable button to prevent double submits
    const originalText = deployFullHostingBtn.textContent;
    deployFullHostingBtn.disabled = true;
    deployFullHostingBtn.textContent = 'Processing…';

    try {
      const res = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'full-hosting',   // GitHub full-hosting
          sessionId,
          domain,
          durationYears,          // ✅ matches backend (not legacy `duration`)
          businessName
        })
      });

      // Try to parse json safely (even if not ok)
      let data = {};
      try { data = await res.json(); } catch { /* ignore parse errors */ }

      if (res.ok && data?.url) {
        window.location.href = data.url; // Stripe Checkout
      } else {
        console.error('Create checkout session failed:', data);
        alert('⚠️ Failed to create checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Stripe checkout error:', err);
      alert('❌ Error creating Stripe session. Check console for details.');
    } finally {
      // Re-enable only if we didn’t redirect
      if (!document.hidden) {
        deployFullHostingBtn.disabled = false;
        deployFullHostingBtn.textContent = originalText;
      }
    }
  });
}

