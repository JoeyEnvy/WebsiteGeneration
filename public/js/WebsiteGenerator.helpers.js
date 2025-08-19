// =======================
// ✅ Stripe Checkout + Helpers
// =======================
WebsiteGenerator.prototype.startStripeCheckout = async function(type) {
  try {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }

    const businessName = this.form.querySelector('[name="businessName"]')?.value || 'website';

    const payload = { type, sessionId, businessName };

    if (type === 'full-hosting') {
      payload.domain = localStorage.getItem('customDomain');
      payload.duration = localStorage.getItem('domainDuration') || '1';
    }

    console.log('🚀 Stripe payload:', payload);

    const response = await fetch('https://websitegeneration.onrender.com/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('💳 Stripe response:', data);

    if (data.url) {
      window.location.href = data.url;
    } else {
      this.showError('❌ Failed to start checkout session.');
    }
  } catch (err) {
    console.error('Stripe Checkout error:', err);
    this.showError('❌ Something went wrong with payment.');
  }
};

// =======================
// ✅ Step Navigation
// =======================
WebsiteGenerator.prototype.goToStep = function(stepNumber) {
  document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
  document.getElementById(`step${stepNumber}`).style.display = 'block';
  this.currentStep = stepNumber;
  this.highlightStep(stepNumber);
};

WebsiteGenerator.prototype.highlightStep = function(stepNumber) {
  document.querySelectorAll('.step-progress-bar .step').forEach((el, index) => {
    el.classList.toggle('active', index === stepNumber - 1);
  });
};

// =======================
// ✅ Loading Indicators
// =======================
WebsiteGenerator.prototype.showLoading = function() {
  if (this.form.querySelector('.loader')) return; // prevent duplicates
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.innerHTML = '<span class="spinner"></span> Generating website...';
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

// =======================
// ✅ Alerts
// =======================
WebsiteGenerator.prototype.showSuccess = function(message) {
  this._showAlert(message, 'alert-success');
};

WebsiteGenerator.prototype.showError = function(message) {
  this._showAlert(message, 'alert-error');
};

WebsiteGenerator.prototype._showAlert = function(message, className) {
  let container = document.getElementById('alertContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'alertContainer';
    this.form.insertBefore(container, this.form.firstChild);
  }
  const alert = document.createElement('div');
  alert.className = `alert ${className}`;
  alert.innerHTML = message;
  container.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
};
