WebsiteGenerator.prototype.startStripeCheckout = async function(type) {
  try {
    // Ensure a sessionId
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      localStorage.setItem('sessionId', sessionId);
    }

    // ✅ Consistent backend base (same as domainChecker + submit.js)
    const backendHost =
      window.PUBLIC_BACKEND_URL ||
      (window.location.protocol.startsWith('http')
        ? `${window.location.protocol}//${window.location.host}`
        : 'http://localhost:3000');

    // Build payload
    const businessName = this.form.querySelector('[name="businessName"]')?.value || 'website';
    const payload = { type, sessionId, businessName };

    if (type === 'full-hosting') {
      const domain = (localStorage.getItem('customDomain') || '').trim().toLowerCase();
      const durationYears = parseInt(localStorage.getItem('domainDuration') || '1', 10) || 1;

      payload.domain = domain;
      payload.durationYears = durationYears; // <-- use durationYears (not "duration")
    }

    // Call the correct endpoint (mounted at /stripe)
    const response = await fetch(`${backendHost}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Defensive handling to avoid parsing HTML error pages as JSON
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Stripe init failed: ${response.status} ${response.statusText} — ${text.slice(0,200)}`);
    }

    const data = await response.json();
    if (data && data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error('Stripe response missing "url".');
  } catch (err) {
    console.error('Stripe Checkout error:', err);
    alert(`Something went wrong with payment.\n${err.message || err}`);
  }
};

WebsiteGenerator.prototype.goToStep = function(stepNumber) {
  document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
  const el = document.getElementById(`step${stepNumber}`);
  if (el) el.style.display = 'block';
  this.currentStep = stepNumber;
  this.highlightStep(stepNumber);
};

WebsiteGenerator.prototype.highlightStep = function(stepNumber) {
  document.querySelectorAll('.step-progress-bar .step').forEach((el, index) => {
    el.classList.toggle('active', index === stepNumber - 1);
  });
};

WebsiteGenerator.prototype.showLoading = function() {
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.innerHTML = 'Generating website...';
  this.form.appendChild(loader);

  const submitBtn = this.form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
};

WebsiteGenerator.prototype.hideLoading = function() {
  const loader = this.form.querySelector('.loader');
  if (loader) loader.remove();

  const submitBtn = this.form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = false;
};

WebsiteGenerator.prototype.showSuccess = function(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success';
  alert.innerHTML = message;
  this.form.insertBefore(alert, this.form.firstChild);
  setTimeout(() => alert.remove(), 5000);
};

WebsiteGenerator.prototype.showError = function(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.innerHTML = message;
  this.form.insertBefore(alert, this.form.firstChild);
  setTimeout(() => alert.remove(), 5000);
};
