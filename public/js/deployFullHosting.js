const deployFullHostingBtn = document.getElementById('deployFullHosting');

if (deployFullHostingBtn) {
  deployFullHostingBtn.addEventListener('click', async () => {
    const domain = document.getElementById('customDomain')?.value?.trim().toLowerCase();
    const duration = document.getElementById('domainDuration')?.value || '1';
    const businessName = localStorage.getItem('businessName');
    let sessionId = localStorage.getItem('sessionId');

    if (!domain || !isValidDomain(domain)) {
      alert('❌ Please enter a valid domain.');
      return;
    }

    if (!businessName) {
      alert('⚠️ Please complete business info first.');
      return;
    }

    // Generate and store session ID if not present
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }

    // Persist domain and duration
    localStorage.setItem('customDomain', domain);
    localStorage.setItem('domainDuration', duration);

    // Extract price from UI and store for reference
    const priceDisplay = document.getElementById('domainPriceDisplay');
    if (priceDisplay) {
      const match = priceDisplay.textContent.match(/£(\d+(\.\d+)?)/);
      if (match) {
        localStorage.setItem('domainPrice', match[1]);
      }
    }

    try {
      const res = await fetch('https://websitegeneration.onrender.com/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'full-hosting',
          sessionId,
          domain,
          duration,
          businessName
        })
      });

      const data = await res.json();
      if (data.url) {
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
