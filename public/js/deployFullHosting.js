const deployFullHostingBtn = document.getElementById('deployFullHosting');

if (deployFullHostingBtn) {
  deployFullHostingBtn.addEventListener('click', async () => {
    const domainInput = document.getElementById('customDomain');
    const durationSelect = document.getElementById('domainDuration');
    const priceDisplay = document.getElementById('domainPriceDisplay');
    const statusContainer = document.getElementById('statusContainer'); // 🔄 Log container

    const domain = domainInput?.value?.trim().toLowerCase();
    const duration = durationSelect?.value || '1';
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

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }

    localStorage.setItem('customDomain', domain);
    localStorage.setItem('domainDuration', duration);

    if (priceDisplay) {
      const match = priceDisplay.textContent.match(/£(\d+(\.\d+)?)/);
      if (match) {
        localStorage.setItem('domainPrice', match[1]);
      }
    }

    try {
      // ✅ Start status polling immediately
      startStatusPolling(sessionId); 

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
        stopStatusPolling(); // ⛔ Stop polling on error
      }
    } catch (err) {
      alert('❌ Error creating Stripe session. Check console.');
      console.error('Stripe checkout error:', err);
      stopStatusPolling(); // ⛔ Stop polling on exception
    }
  });
}

// 🔁 Polling functions (can be placed in a shared utils file)
let pollInterval;

function startStatusPolling(sessionId) {
  const container = document.getElementById('statusContainer');
  if (!container) return;

  container.style.display = 'block';
  container.innerHTML = '<div>⏳ Preparing deployment...</div>';

  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`https://websitegeneration.onrender.com/get-status?sessionId=${sessionId}`);
      const data = await res.json();

      if (Array.isArray(data.statusLog)) {
        container.innerHTML = data.statusLog.map(line => `<div>${line}</div>`).join('');
      }

      if (data.statusLog?.some(line => line.includes("🎉 Website is live!"))) {
        clearInterval(pollInterval);
      }
    } catch (err) {
      console.error('Polling error:', err);
      clearInterval(pollInterval);
    }
  }, 2000);
}

function stopStatusPolling() {
  clearInterval(pollInterval);
}
