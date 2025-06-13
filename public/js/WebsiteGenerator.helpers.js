WebsiteGenerator.prototype.startStripeCheckout = async function(type) {
  try {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }

    const businessName = this.form.querySelector('[name="businessName"]')?.value || 'website';

    const payload = {
      type,
      sessionId,
      businessName
    };

    if (type === 'full-hosting') {
      payload.domain = localStorage.getItem('customDomain');
      payload.duration = localStorage.getItem('domainDuration') || '1';
    }

    const response = await fetch('https://websitegeneration.onrender.com/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Failed to start checkout session.');
    }
  } catch (err) {
    console.error('Stripe Checkout error:', err);
    alert('Something went wrong with payment.');
  }
};

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
